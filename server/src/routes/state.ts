import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import { profileStates, users } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import type { AppVariables } from '../middleware/session.js'
import { migrateState } from '../../../shared/migrateState.js'
import { EMPTY_STATE } from '../../../shared/types.js'
import { resolveActiveProfile } from '../lib/profiles.js'

const MAX_BODY_BYTES = 1_048_576

const favoriteFolderSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
})

const tradeSchema = z.object({
  id: z.string().min(1).max(64),
  givenCardId: z.string().min(1).max(32),
  receivedCardId: z.string().max(32).optional(),
  partner: z.string().max(256).optional(),
  note: z.string().max(2000).optional(),
  createdAt: z.string().min(1).max(64),
  source: z.enum(['completed', 'observed', 'cancelled']).optional(),
})

const potentialTradeSchema = z.object({
  id: z.string().min(1).max(64),
  givenCardId: z.string().min(1).max(32),
  receivedCardId: z.string().max(32).optional(),
  partner: z.string().max(256).optional(),
  note: z.string().max(2000).optional(),
  createdAt: z.string().min(1).max(64),
})

const appStateSchema = z.object({
  owned: z.record(z.string(), z.number().int().min(0).max(9999)),
  neededBy: z.record(z.string(), z.array(z.string().min(1).max(64))),
  favoriteFolders: z.array(favoriteFolderSchema).max(50).optional(),
  accounts: z.array(favoriteFolderSchema).max(50).optional(),
  trades: z.array(tradeSchema).max(10_000),
  potentialTrades: z.array(potentialTradeSchema).max(1000),
  locale: z.enum(['ru', 'en']).optional(),
})

async function resolveUserActiveProfile(db: Db, userId: string) {
  const [u] = await db
    .select({ activeProfileId: users.activeProfileId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return resolveActiveProfile(db, userId, u?.activeProfileId)
}

export function createStateRoutes(db: Db) {
  const app = new Hono<{ Variables: AppVariables }>()

  app.use('*', requireAuth)

  app.get('/', async (c) => {
    const user = c.get('user')!
    const profile = await resolveUserActiveProfile(db, user.id)
    if (!profile) {
      return c.json({ data: migrateState(EMPTY_STATE) })
    }

    const rows = await db
      .select({ data: profileStates.data })
      .from(profileStates)
      .where(eq(profileStates.profileId, profile.id))
      .limit(1)

    const data = rows[0]?.data ?? EMPTY_STATE
    return c.json({ data: migrateState(data) })
  })

  app.put('/', async (c) => {
    const raw = await c.req.text().catch(() => '')
    if (raw.length > MAX_BODY_BYTES) {
      return c.json({ error: 'Payload too large' }, 413)
    }

    let body: unknown = null
    try {
      body = raw ? JSON.parse(raw) : null
    } catch {
      body = null
    }
    const parsed = appStateSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid state' }, 400)
    }

    const user = c.get('user')!
    const profile = await resolveUserActiveProfile(db, user.id)
    if (!profile) {
      return c.json({ error: 'Create a game profile before saving state' }, 400)
    }

    const migrated = migrateState(parsed.data)

    await db
      .insert(profileStates)
      .values({
        profileId: profile.id,
        data: migrated,
        updatedAt: new Date(),
        updatedByUserId: user.id,
      })
      .onConflictDoUpdate({
        target: profileStates.profileId,
        set: {
          data: migrated,
          updatedAt: new Date(),
          updatedByUserId: user.id,
        },
      })

    return c.json({ data: migrated })
  })

  return app
}
