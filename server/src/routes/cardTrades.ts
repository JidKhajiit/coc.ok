import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '../db/index.js'
import {
  cardTradeUserStates,
  userStates,
  users,
} from '../db/schema.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import type { AppVariables } from '../middleware/session.js'
import { EMPTY_STATE, type AppState } from '../../../shared/types.js'
import { migrateState } from '../../../shared/migrateState.js'
import { cardId, type CardTradeCard, type CardTradeEventSeed, type CardTradeSet } from '../../../shared/cardTradeCatalog.js'
import {
  createCardTradeEvent,
  getCardTradeEventBySlug,
  listCardTradeEvents,
  type CardTradeEventDetail,
  updateCardTradeEvent,
} from '../lib/cardTradeEvents.js'

const MAX_BODY_BYTES = 1_048_576

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
const eventSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and -')
const shareSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Slug may only contain letters, numbers, _ and -')

const accountSchema = z.object({
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
  accounts: z.array(accountSchema).max(50),
  trades: z.array(tradeSchema).max(10_000),
  potentialTrades: z.array(potentialTradeSchema).max(1000),
  locale: z.enum(['ru', 'en']).optional(),
})

const cardTradeSetSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(128),
  from: z.number().int().min(1).max(9999),
  to: z.number().int().min(1).max(9999),
})

const cardTradeCardInputSchema = z.object({
  number: z.number().int().min(1).max(9999),
  name: z.string().trim().min(1).max(128),
  rarity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  color: z.enum(['blue', 'gold']),
  unknownName: z.boolean().optional(),
})

const createCardTradeEventSchema = z.object({
  slug: eventSlugSchema,
  name: z.string().trim().min(1).max(128),
  startDate: dateSchema,
  endDate: dateSchema,
  sets: z.array(cardTradeSetSchema).min(1).max(200),
  cards: z.array(cardTradeCardInputSchema).min(1).max(5000),
})

type PublicCollectionPayload = {
  slug: string
  username: string
  owned: Record<string, number>
  neededBy: Record<string, string[]>
  accounts: AppState['accounts']
  updatedAt: string
  stats: {
    uniqueOwned: number
    neededCount: number
  }
  event: {
    slug: string
    name: string
    cardCount: number
  }
}

function toPublicPayload(
  shareSlug: string,
  username: string,
  data: AppState,
  updatedAt: Date,
  event: CardTradeEventDetail,
): PublicCollectionPayload {
  const migrated = migrateState(data)
  const ownedIds = Object.keys(migrated.owned).filter((id) => (migrated.owned[id] ?? 0) > 0)
  return {
    slug: shareSlug,
    username,
    owned: migrated.owned,
    neededBy: migrated.neededBy,
    accounts: migrated.accounts,
    updatedAt: updatedAt.toISOString(),
    stats: {
      uniqueOwned: ownedIds.length,
      neededCount: Object.keys(migrated.neededBy).filter((id) => (migrated.neededBy[id] ?? []).length > 0)
        .length,
    },
    event: {
      slug: event.slug,
      name: event.name,
      cardCount: event.cardCount,
    },
  }
}

function buildEventSeed(input: z.infer<typeof createCardTradeEventSchema>): CardTradeEventSeed {
  const sets = [...input.sets]
    .map((set) => ({ ...set, id: set.id.trim(), name: set.name.trim() }))
    .sort((a, b) => a.from - b.from || a.to - b.to || a.id.localeCompare(b.id))
  const cardsInput = [...input.cards].sort((a, b) => a.number - b.number)

  if (new Date(input.startDate) > new Date(input.endDate)) {
    throw new Error('Start date must be before or equal to end date')
  }

  const setIds = new Set<string>()
  for (const set of sets) {
    if (setIds.has(set.id)) throw new Error(`Duplicate set id: ${set.id}`)
    if (set.from > set.to) throw new Error(`Invalid range for set ${set.id}`)
    setIds.add(set.id)
  }
  for (let i = 1; i < sets.length; i += 1) {
    const prev = sets[i - 1]!
    const cur = sets[i]!
    if (cur.from <= prev.to) {
      throw new Error(`Set ranges overlap: ${prev.id} and ${cur.id}`)
    }
  }

  const cards: CardTradeCard[] = []
  const numbers = new Set<number>()
  for (const card of cardsInput) {
    if (numbers.has(card.number)) throw new Error(`Duplicate card number: ${card.number}`)
    numbers.add(card.number)
    const set = sets.find((item) => card.number >= item.from && card.number <= item.to)
    if (!set) throw new Error(`Card #${card.number} does not fit any set range`)
    cards.push({
      id: cardId(card.number),
      name: card.name.trim(),
      number: card.number,
      rarity: card.rarity,
      color: card.color,
      setId: set.id,
      setName: set.name,
      ...(card.unknownName ? { unknownName: true } : {}),
    })
  }

  return {
    slug: input.slug,
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    active: true,
    sets: sets as CardTradeSet[],
    cards,
  }
}

async function loadEventOr404(c: any, db: Db) {
  const event = await getCardTradeEventBySlug(db, c.req.param('eventSlug'))
  if (!event) {
    c.status(404)
    return null
  }
  return event
}

function isSummerParty(eventSlug: string) {
  return eventSlug === 'summer-party'
}

async function loadLegacyState(db: Db, userId: string) {
  const rows = await db
    .select({
      data: userStates.data,
      shareEnabled: userStates.shareEnabled,
      shareSlug: userStates.shareSlug,
      updatedAt: userStates.updatedAt,
    })
    .from(userStates)
    .where(eq(userStates.userId, userId))
    .limit(1)
  return rows[0] ?? null
}

async function loadEventState(db: Db, event: CardTradeEventDetail, userId: string) {
  const rows = await db
    .select({
      data: cardTradeUserStates.data,
      shareEnabled: cardTradeUserStates.shareEnabled,
      shareSlug: cardTradeUserStates.shareSlug,
      updatedAt: cardTradeUserStates.updatedAt,
    })
    .from(cardTradeUserStates)
    .where(and(eq(cardTradeUserStates.userId, userId), eq(cardTradeUserStates.eventId, event.id)))
    .limit(1)

  if (rows[0]) return rows[0]
  if (isSummerParty(event.slug)) return loadLegacyState(db, userId)
  return null
}

async function upsertEventState(
  db: Db,
  event: CardTradeEventDetail,
  userId: string,
  state: AppState,
  share?: { enabled: boolean; slug: string | null },
) {
  const now = new Date()
  await db
    .insert(cardTradeUserStates)
    .values({
      userId,
      eventId: event.id,
      data: state,
      updatedAt: now,
      ...(share ? { shareEnabled: share.enabled, shareSlug: share.slug } : {}),
    })
    .onConflictDoUpdate({
      target: [cardTradeUserStates.userId, cardTradeUserStates.eventId],
      set: {
        data: state,
        updatedAt: now,
        ...(share ? { shareEnabled: share.enabled, shareSlug: share.slug } : {}),
      },
    })

  if (isSummerParty(event.slug)) {
    await db
      .insert(userStates)
      .values({
        userId,
        data: state,
        updatedAt: now,
        shareEnabled: share?.enabled ?? false,
        shareSlug: share?.slug ?? null,
      })
      .onConflictDoUpdate({
        target: userStates.userId,
        set: {
          data: state,
          updatedAt: now,
          ...(share ? { shareEnabled: share.enabled, shareSlug: share.slug } : {}),
        },
      })
  }
}

async function updateShareOnly(
  db: Db,
  event: CardTradeEventDetail,
  userId: string,
  enabled: boolean,
  slug: string,
) {
  const current = await loadEventState(db, event, userId)
  const data = migrateState((current?.data ?? EMPTY_STATE) as AppState)
  await upsertEventState(db, event, userId, data, { enabled, slug })
}

async function shareSlugTaken(db: Db, event: CardTradeEventDetail, slug: string, userId: string) {
  const rows = await db
    .select({ userId: cardTradeUserStates.userId })
    .from(cardTradeUserStates)
    .where(
      and(
        eq(cardTradeUserStates.eventId, event.id),
        eq(cardTradeUserStates.shareSlug, slug),
      ),
    )
    .limit(1)
  if (rows[0] && rows[0].userId !== userId) return true

  if (!isSummerParty(event.slug)) return false

  const legacy = await db
    .select({ userId: userStates.userId })
    .from(userStates)
    .where(eq(userStates.shareSlug, slug))
    .limit(1)
  return Boolean(legacy[0] && legacy[0].userId !== userId)
}

type SharedRow = {
  userId: string
  username: string
  shareSlug: string
  updatedAt: Date
  data: AppState
}

async function listSharedRows(db: Db, event: CardTradeEventDetail): Promise<SharedRow[]> {
  const rows = await db
    .select({
      userId: cardTradeUserStates.userId,
      username: users.username,
      shareSlug: cardTradeUserStates.shareSlug,
      updatedAt: cardTradeUserStates.updatedAt,
      data: cardTradeUserStates.data,
    })
    .from(cardTradeUserStates)
    .innerJoin(users, eq(cardTradeUserStates.userId, users.id))
    .where(and(eq(cardTradeUserStates.eventId, event.id), eq(cardTradeUserStates.shareEnabled, true)))
    .orderBy(desc(cardTradeUserStates.updatedAt))

  const next = rows
    .filter((row): row is SharedRow => Boolean(row.shareSlug))
    .map((row) => ({
      userId: row.userId,
      username: row.username,
      shareSlug: row.shareSlug!,
      updatedAt: row.updatedAt,
      data: row.data,
    }))

  if (!isSummerParty(event.slug)) return next

  const userIdsWithNewState = new Set(next.map((row) => row.userId))
  const legacyRows = await db
    .select({
      userId: userStates.userId,
      username: users.username,
      shareSlug: userStates.shareSlug,
      updatedAt: userStates.updatedAt,
      data: userStates.data,
    })
    .from(userStates)
    .innerJoin(users, eq(userStates.userId, users.id))
    .where(eq(userStates.shareEnabled, true))
    .orderBy(desc(userStates.updatedAt))

  for (const row of legacyRows) {
    if (!row.shareSlug || userIdsWithNewState.has(row.userId)) continue
    next.push({
      userId: row.userId,
      username: row.username,
      shareSlug: row.shareSlug,
      updatedAt: row.updatedAt,
      data: row.data,
    })
  }

  return next.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
}

export function createCardTradesRoutes(db: Db) {
  const app = new Hono<{ Variables: AppVariables }>()

  app.get('/events', async (c) => {
    const events = await listCardTradeEvents(db)
    return c.json({ events })
  })

  app.get('/events/:eventSlug', async (c) => {
    const event = await getCardTradeEventBySlug(db, c.req.param('eventSlug'))
    if (!event) return c.json({ error: 'Event not found' }, 404)
    return c.json({ event })
  })

  app.get('/:eventSlug/collections', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const rows = await listSharedRows(db, event)
    const collections = rows.map((row) => {
      const state = migrateState(row.data)
      return {
        slug: row.shareSlug,
        username: row.username,
        updatedAt: row.updatedAt.toISOString(),
        stats: {
          uniqueOwned: Object.keys(state.owned).filter((id) => (state.owned[id] ?? 0) > 0).length,
          neededCount: Object.keys(state.neededBy).filter((id) => (state.neededBy[id] ?? []).length > 0)
            .length,
        },
        event: {
          slug: event.slug,
          name: event.name,
          cardCount: event.cardCount,
        },
      }
    })

    return c.json({ collections })
  })

  app.get('/:eventSlug/collections/:slug', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const slug = c.req.param('slug')
    const rows = await listSharedRows(db, event)
    const row = rows.find((item) => item.shareSlug === slug)
    if (!row) return c.json({ error: 'Collection not found' }, 404)

    return c.json({
      collection: toPublicPayload(row.shareSlug, row.username, row.data, row.updatedAt, event),
      event,
    })
  })

  app.use('/:eventSlug/state', requireAuth)
  app.get('/:eventSlug/state', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const user = c.get('user')!
    const row = await loadEventState(db, event, user.id)
    return c.json({ data: migrateState((row?.data ?? EMPTY_STATE) as AppState) })
  })

  app.put('/:eventSlug/state', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const raw = await c.req.text().catch(() => '')
    if (raw.length > MAX_BODY_BYTES) return c.json({ error: 'Payload too large' }, 413)

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
    const current = await loadEventState(db, event, user.id)
    const migrated = migrateState(parsed.data as AppState)
    await upsertEventState(db, event, user.id, migrated, {
      enabled: current?.shareEnabled ?? false,
      slug: current?.shareSlug ?? null,
    })
    return c.json({ data: migrated })
  })

  app.use('/:eventSlug/share', requireAuth)
  app.get('/:eventSlug/share', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const user = c.get('user')!
    const row = await loadEventState(db, event, user.id)
    return c.json({
      share: {
        enabled: row?.shareEnabled ?? false,
        slug: row?.shareSlug ?? user.username,
      },
    })
  })

  app.put('/:eventSlug/share', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const user = c.get('user')!
    const body = await c.req.json().catch(() => null)
    const schema = z.object({
      enabled: z.boolean(),
      slug: shareSlugSchema.optional(),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const slug = parsed.data.slug?.trim() || user.username
    if (await shareSlugTaken(db, event, slug, user.id)) {
      return c.json({ error: 'This link is already taken' }, 409)
    }

    await updateShareOnly(db, event, user.id, parsed.data.enabled, slug)
    return c.json({
      share: {
        enabled: parsed.data.enabled,
        slug,
      },
    })
  })

  app.use('/admin/events', requireAuth, requirePermission('events:manage'))
  app.post('/admin/events', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = createCardTradeEventSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    try {
      const event = await createCardTradeEvent(db, buildEventSeed(parsed.data))
      return c.json({ event }, 201)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create event'
      const status = /already exists|duplicate/i.test(message) ? 409 : 400
      return c.json({ error: message }, status)
    }
  })

  app.put('/admin/events/:eventId', async (c) => {
    const eventId = c.req.param('eventId')
    const body = await c.req.json().catch(() => null)
    const parsed = createCardTradeEventSchema.omit({ slug: true }).safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    try {
      const seed = buildEventSeed({ ...parsed.data, slug: 'ignore-slug' })
      const event = await updateCardTradeEvent(db, eventId, {
        name: seed.name,
        startDate: seed.startDate,
        endDate: seed.endDate,
        active: true,
        sets: seed.sets,
        cards: seed.cards,
      })
      return c.json({ event })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update event'
      const status = /not found/i.test(message) ? 404 : 400
      return c.json({ error: message }, status)
    }
  })

  return app
}
