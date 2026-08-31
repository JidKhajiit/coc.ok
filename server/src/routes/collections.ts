import { Hono } from 'hono'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import type { AppVariables } from '../middleware/session.js'
import { requireAuth } from '../middleware/auth.js'
import type { Db } from '../db/index.js'
import { userStates, users } from '../db/schema.js'
import { migrateState } from '../../../shared/migrateState.js'
import type { AppState } from '../../../shared/types.js'

const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Slug may only contain letters, numbers, _ and -')

function publicPayload(
  slug: string,
  username: string,
  data: AppState,
  updatedAt: Date,
) {
  const migrated = migrateState(data)
  const ownedIds = Object.keys(migrated.owned).filter((id) => (migrated.owned[id] ?? 0) > 0)
  return {
    slug,
    username,
    owned: migrated.owned,
    neededBy: migrated.neededBy,
    accounts: migrated.accounts,
    updatedAt: updatedAt.toISOString(),
    stats: {
      uniqueOwned: ownedIds.length,
      neededCount: Object.keys(migrated.neededBy).filter(
        (id) => (migrated.neededBy[id] ?? []).length > 0,
      ).length,
    },
  }
}

export function createCollectionsRoutes(db: Db) {
  const app = new Hono()

  app.get('/', async (c) => {
    const rows = await db
      .select({
        slug: userStates.shareSlug,
        username: users.username,
        updatedAt: userStates.updatedAt,
        data: userStates.data,
      })
      .from(userStates)
      .innerJoin(users, eq(userStates.userId, users.id))
      .where(eq(userStates.shareEnabled, true))
      .orderBy(desc(userStates.updatedAt))

    const collections = rows
      .filter((row) => row.slug)
      .map((row) => {
        const migrated = migrateState(row.data)
        const uniqueOwned = Object.keys(migrated.owned).filter(
          (id) => (migrated.owned[id] ?? 0) > 0,
        ).length
        return {
          slug: row.slug!,
          username: row.username,
          updatedAt: row.updatedAt.toISOString(),
          stats: {
            uniqueOwned,
            neededCount: Object.keys(migrated.neededBy).filter(
              (id) => (migrated.neededBy[id] ?? []).length > 0,
            ).length,
          },
        }
      })

    return c.json({ collections })
  })

  app.get('/:slug', async (c) => {
    const slug = c.req.param('slug')
    const rows = await db
      .select({
        slug: userStates.shareSlug,
        username: users.username,
        data: userStates.data,
        updatedAt: userStates.updatedAt,
        shareEnabled: userStates.shareEnabled,
      })
      .from(userStates)
      .innerJoin(users, eq(userStates.userId, users.id))
      .where(eq(userStates.shareSlug, slug))
      .limit(1)

    const row = rows[0]
    if (!row?.shareEnabled || !row.slug) {
      return c.json({ error: 'Collection not found' }, 404)
    }

    return c.json({
      collection: publicPayload(row.slug, row.username, row.data, row.updatedAt),
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
    const rows = await db
      .select({
        shareEnabled: userStates.shareEnabled,
        shareSlug: userStates.shareSlug,
      })
      .from(userStates)
      .where(eq(userStates.userId, user.id))
      .limit(1)

    const row = rows[0]
    return c.json({
      share: {
        enabled: row?.shareEnabled ?? false,
        slug: row?.shareSlug ?? user.username,
      },
    })
  })

  app.put('/', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    const body = await c.req.json().catch(() => null)
    const schema = z.object({
      enabled: z.boolean(),
      slug: slugSchema.optional(),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const slug = parsed.data.slug?.trim() || user.username
    const existing = await db
      .select({ userId: userStates.userId })
      .from(userStates)
      .where(eq(userStates.shareSlug, slug))
      .limit(1)

    if (existing[0] && existing[0].userId !== user.id) {
      return c.json({ error: 'This link is already taken' }, 409)
    }

    const [updated] = await db
      .update(userStates)
      .set({
        shareEnabled: parsed.data.enabled,
        shareSlug: slug,
        updatedAt: new Date(),
      })
      .where(eq(userStates.userId, user.id))
      .returning({
        shareEnabled: userStates.shareEnabled,
        shareSlug: userStates.shareSlug,
      })

    return c.json({
      share: {
        enabled: updated?.shareEnabled ?? parsed.data.enabled,
        slug: updated?.shareSlug ?? slug,
      },
    })
  })

  return app
}
