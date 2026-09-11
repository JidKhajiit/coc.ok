import { Hono } from 'hono'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import type { AppVariables } from '../middleware/session.js'
import { requireAuth } from '../middleware/auth.js'
import type { Db } from '../db/index.js'
import { profileStates, profiles, users } from '../db/schema.js'
import { migrateState } from '../../../shared/migrateState.js'
import { computeCollectionStats } from '../../../shared/collectionStats.js'
import { countCompletedTradesToday } from '../../../shared/gameDay.js'
import { DAILY_TRADE_INITIATION_LIMIT, EMPTY_STATE, type AppState } from '../../../shared/types.js'
import { generateShareSlug, looksLikeOpaqueShareSlug } from '../lib/shareSlug.js'
import { resolveActiveProfile } from '../lib/profiles.js'

function publicPayload(
  slug: string,
  username: string,
  acceptTradeOffers: boolean,
  data: AppState,
  updatedAt: Date,
) {
  const migrated = migrateState(data)
  const stats = computeCollectionStats(migrated.owned, migrated.neededBy)
  return {
    slug,
    username,
    acceptTradeOffers,
    owned: migrated.owned,
    neededBy: migrated.neededBy,
    favoriteFolders: migrated.favoriteFolders,
    updatedAt: updatedAt.toISOString(),
    stats: {
      uniqueOwned: stats.uniqueOwned,
      neededCount: stats.neededCount,
      tradeable: stats.tradeable,
      tradesToday: countCompletedTradesToday(migrated.trades),
      tradeAttemptsLeft: migrated.tradeAttemptsLeft ?? DAILY_TRADE_INITIATION_LIMIT,
    },
  }
}

async function resolveUserActiveProfile(db: Db, userId: string) {
  const [u] = await db
    .select({ activeProfileId: users.activeProfileId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return resolveActiveProfile(db, userId, u?.activeProfileId)
}

export function createCollectionsRoutes(db: Db) {
  const app = new Hono()

  app.get('/', async (c) => {
    const rows = await db
      .select({
        slug: profileStates.shareSlug,
        username: profiles.nickname,
        acceptTradeOffers: profileStates.acceptTradeOffers,
        updatedAt: profileStates.updatedAt,
        data: profileStates.data,
      })
      .from(profileStates)
      .innerJoin(profiles, eq(profileStates.profileId, profiles.id))
      .where(eq(profileStates.shareEnabled, true))
      .orderBy(desc(profileStates.updatedAt))

    const collections = rows
      .filter((row) => row.slug)
      .map((row) => {
        const migrated = migrateState(row.data)
        const stats = computeCollectionStats(migrated.owned, migrated.neededBy)
        return {
          slug: row.slug!,
          username: row.username,
          acceptTradeOffers: row.acceptTradeOffers,
          updatedAt: row.updatedAt.toISOString(),
          stats: {
            uniqueOwned: stats.uniqueOwned,
            neededCount: stats.neededCount,
            tradeable: stats.tradeable,
            tradesToday: countCompletedTradesToday(migrated.trades),
            tradeAttemptsLeft: migrated.tradeAttemptsLeft ?? DAILY_TRADE_INITIATION_LIMIT,
          },
        }
      })

    return c.json({ collections })
  })

  app.get('/:slug', async (c) => {
    const slug = c.req.param('slug')
    const rows = await db
      .select({
        slug: profileStates.shareSlug,
        username: profiles.nickname,
        acceptTradeOffers: profileStates.acceptTradeOffers,
        data: profileStates.data,
        updatedAt: profileStates.updatedAt,
        shareEnabled: profileStates.shareEnabled,
      })
      .from(profileStates)
      .innerJoin(profiles, eq(profileStates.profileId, profiles.id))
      .where(eq(profileStates.shareSlug, slug))
      .limit(1)

    const row = rows[0]
    if (!row?.shareEnabled || !row.slug) {
      return c.json({ error: 'Collection not found' }, 404)
    }

    return c.json({
      collection: publicPayload(
        row.slug,
        row.username,
        row.acceptTradeOffers,
        row.data,
        row.updatedAt,
      ),
    })
  })

  return app
}

export function createShareRoutes(db: Db) {
  const app = new Hono<{ Variables: AppVariables }>()
  app.use('*', requireAuth)

  app.get('/', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const profile = await resolveUserActiveProfile(db, user.id)
    if (!profile) {
      return c.json({
        share: { enabled: false, slug: '', acceptTradeOffers: true },
      })
    }

    const rows = await db
      .select({
        shareEnabled: profileStates.shareEnabled,
        shareSlug: profileStates.shareSlug,
        acceptTradeOffers: profileStates.acceptTradeOffers,
      })
      .from(profileStates)
      .where(eq(profileStates.profileId, profile.id))
      .limit(1)

    const row = rows[0]
    return c.json({
      share: {
        enabled: row?.shareEnabled ?? false,
        slug: row?.shareSlug ?? '',
        acceptTradeOffers: row?.acceptTradeOffers ?? true,
      },
    })
  })

  app.put('/', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const profile = await resolveUserActiveProfile(db, user.id)
    if (!profile?.gameUid) {
      return c.json({ error: 'Set your game UID in site settings before sharing' }, 400)
    }

    const body = await c.req.json().catch(() => null)
    const schema = z.object({
      enabled: z.boolean(),
      acceptTradeOffers: z.boolean().optional(),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const current = await db
      .select({
        shareSlug: profileStates.shareSlug,
        acceptTradeOffers: profileStates.acceptTradeOffers,
      })
      .from(profileStates)
      .where(eq(profileStates.profileId, profile.id))
      .limit(1)

    let slug = current[0]?.shareSlug ?? null
    if (!slug || !looksLikeOpaqueShareSlug(slug, profile.gameUid)) {
      for (let i = 0; i < 8; i += 1) {
        const candidate = generateShareSlug()
        const taken = await db
          .select({ profileId: profileStates.profileId })
          .from(profileStates)
          .where(eq(profileStates.shareSlug, candidate))
          .limit(1)
        if (!taken[0] || taken[0].profileId === profile.id) {
          slug = candidate
          break
        }
      }
    }
    if (!slug) return c.json({ error: 'Could not allocate share link' }, 500)

    const acceptTradeOffers = parsed.data.acceptTradeOffers ?? current[0]?.acceptTradeOffers ?? true

    const [updated] = await db
      .update(profileStates)
      .set({
        shareEnabled: parsed.data.enabled,
        shareSlug: slug,
        acceptTradeOffers,
        updatedAt: new Date(),
        updatedByUserId: user.id,
      })
      .where(eq(profileStates.profileId, profile.id))
      .returning({
        shareEnabled: profileStates.shareEnabled,
        shareSlug: profileStates.shareSlug,
        acceptTradeOffers: profileStates.acceptTradeOffers,
      })

    // If no legacy state row yet, insert one so share settings persist.
    if (!updated) {
      await db.insert(profileStates).values({
        profileId: profile.id,
        data: EMPTY_STATE,
        updatedAt: new Date(),
        updatedByUserId: user.id,
        shareEnabled: parsed.data.enabled,
        shareSlug: slug,
        acceptTradeOffers,
      })
    }

    return c.json({
      share: {
        enabled: updated?.shareEnabled ?? parsed.data.enabled,
        slug: updated?.shareSlug ?? slug,
        acceptTradeOffers: updated?.acceptTradeOffers ?? acceptTradeOffers,
      },
    })
  })

  return app
}
