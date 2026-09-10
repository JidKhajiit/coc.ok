import { Hono } from 'hono'
import { and, desc, eq, or } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '../db/index.js'
import {
  cardTradeProposals,
  cardTradeUserStates,
  userStates,
  users,
} from '../db/schema.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import type { AppVariables } from '../middleware/session.js'
import { computeCollectionStats } from '../../../shared/collectionStats.js'
import { countCompletedTradesToday } from '../../../shared/gameDay.js'
import { migrateState } from '../../../shared/migrateState.js'
import { DAILY_TRADE_INITIATION_LIMIT, EMPTY_STATE, type AppState, type TradeRecord } from '../../../shared/types.js'
import { cardId, type CardTradeCard, type CardTradeEventSeed, type CardTradeSet } from '../../../shared/cardTradeCatalog.js'
import {
  createCardTradeEvent,
  getCardTradeEventBySlug,
  listCardTradeEvents,
  type CardTradeEventDetail,
  updateCardTradeEvent,
} from '../lib/cardTradeEvents.js'
import { generateShareSlug, looksLikeOpaqueShareSlug } from '../lib/shareSlug.js'

const MAX_BODY_BYTES = 1_048_576

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
const eventSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and -')

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
  tradeAttemptsLeft: z.number().int().min(0).max(3).optional(),
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

export type PopularityTier = 'S' | 'A' | 'B' | 'C' | 'D'

type PublicCollectionPayload = {
  slug: string
  username: string
  acceptTradeOffers: boolean
  owned: Record<string, number>
  neededBy: Record<string, string[]>
  accounts: AppState['accounts']
  updatedAt: string
  stats: {
    uniqueOwned: number
    neededCount: number
    tradeable: number
    tradesToday: number
    tradeAttemptsLeft: number
  }
  event: {
    slug: string
    name: string
    cardCount: number
  }
}

type ShareFields = {
  enabled: boolean
  slug: string | null
  acceptTradeOffers: boolean
}

function toPublicPayload(
  shareSlug: string,
  username: string,
  acceptTradeOffers: boolean,
  data: AppState,
  updatedAt: Date,
  event: CardTradeEventDetail,
): PublicCollectionPayload {
  const migrated = migrateState(data)
  const stats = computeCollectionStats(migrated.owned, migrated.neededBy)
  return {
    slug: shareSlug,
    username,
    acceptTradeOffers,
    owned: migrated.owned,
    neededBy: migrated.neededBy,
    accounts: migrated.accounts,
    updatedAt: updatedAt.toISOString(),
    stats: {
      uniqueOwned: stats.uniqueOwned,
      neededCount: stats.neededCount,
      tradeable: stats.tradeable,
      tradesToday: countCompletedTradesToday(migrated.trades),
      tradeAttemptsLeft: migrated.tradeAttemptsLeft ?? DAILY_TRADE_INITIATION_LIMIT,
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

type StateRow = {
  data: AppState
  shareEnabled: boolean
  shareSlug: string | null
  acceptTradeOffers: boolean
  updatedAt: Date
}

async function loadLegacyState(db: Db, userId: string): Promise<StateRow | null> {
  const rows = await db
    .select({
      data: userStates.data,
      shareEnabled: userStates.shareEnabled,
      shareSlug: userStates.shareSlug,
      acceptTradeOffers: userStates.acceptTradeOffers,
      updatedAt: userStates.updatedAt,
    })
    .from(userStates)
    .where(eq(userStates.userId, userId))
    .limit(1)
  return rows[0] ?? null
}

async function loadEventState(db: Db, event: CardTradeEventDetail, userId: string): Promise<StateRow | null> {
  const rows = await db
    .select({
      data: cardTradeUserStates.data,
      shareEnabled: cardTradeUserStates.shareEnabled,
      shareSlug: cardTradeUserStates.shareSlug,
      acceptTradeOffers: cardTradeUserStates.acceptTradeOffers,
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
  share?: ShareFields,
) {
  const now = new Date()
  await db
    .insert(cardTradeUserStates)
    .values({
      userId,
      eventId: event.id,
      data: state,
      updatedAt: now,
      ...(share
        ? {
            shareEnabled: share.enabled,
            shareSlug: share.slug,
            acceptTradeOffers: share.acceptTradeOffers,
          }
        : {}),
    })
    .onConflictDoUpdate({
      target: [cardTradeUserStates.userId, cardTradeUserStates.eventId],
      set: {
        data: state,
        updatedAt: now,
        ...(share
          ? {
              shareEnabled: share.enabled,
              shareSlug: share.slug,
              acceptTradeOffers: share.acceptTradeOffers,
            }
          : {}),
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
        acceptTradeOffers: share?.acceptTradeOffers ?? true,
      })
      .onConflictDoUpdate({
        target: userStates.userId,
        set: {
          data: state,
          updatedAt: now,
          ...(share
            ? {
                shareEnabled: share.enabled,
                shareSlug: share.slug,
                acceptTradeOffers: share.acceptTradeOffers,
              }
            : {}),
        },
      })
  }
}

async function updateShareOnly(
  db: Db,
  event: CardTradeEventDetail,
  userId: string,
  share: ShareFields,
) {
  const current = await loadEventState(db, event, userId)
  const data = migrateState((current?.data ?? EMPTY_STATE) as AppState)
  await upsertEventState(db, event, userId, data, share)
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

async function allocateShareSlug(
  db: Db,
  event: CardTradeEventDetail,
  userId: string,
  gameUid: string | null,
  currentSlug: string | null,
): Promise<string> {
  if (currentSlug && looksLikeOpaqueShareSlug(currentSlug, gameUid)) {
    return currentSlug
  }
  for (let i = 0; i < 8; i += 1) {
    const slug = generateShareSlug()
    if (!(await shareSlugTaken(db, event, slug, userId))) return slug
  }
  throw new Error('Could not allocate share slug')
}

type SharedRow = {
  userId: string
  username: string
  shareSlug: string
  acceptTradeOffers: boolean
  updatedAt: Date
  data: AppState
}

type TrendSummary = {
  mostGiven: Array<{ cardId: string; count: number }>
  mostRequested: Array<{ cardId: string; count: number }>
  tradeCount: number
}

async function listSharedRows(db: Db, event: CardTradeEventDetail): Promise<SharedRow[]> {
  const rows = await db
    .select({
      userId: cardTradeUserStates.userId,
      username: users.username,
      shareSlug: cardTradeUserStates.shareSlug,
      acceptTradeOffers: cardTradeUserStates.acceptTradeOffers,
      updatedAt: cardTradeUserStates.updatedAt,
      data: cardTradeUserStates.data,
    })
    .from(cardTradeUserStates)
    .innerJoin(users, eq(cardTradeUserStates.userId, users.id))
    .where(and(eq(cardTradeUserStates.eventId, event.id), eq(cardTradeUserStates.shareEnabled, true)))
    .orderBy(desc(cardTradeUserStates.updatedAt))

  const next = rows
    .filter((row): row is typeof row & { shareSlug: string } => Boolean(row.shareSlug))
    .map((row) => ({
      userId: row.userId,
      username: row.username,
      shareSlug: row.shareSlug,
      acceptTradeOffers: row.acceptTradeOffers,
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
      acceptTradeOffers: userStates.acceptTradeOffers,
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
      acceptTradeOffers: row.acceptTradeOffers,
      updatedAt: row.updatedAt,
      data: row.data,
    })
  }

  return next.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
}

async function listTrendStates(
  db: Db,
  event: CardTradeEventDetail,
): Promise<Array<{ userId: string; data: AppState }>> {
  const rows = await db
    .select({
      userId: cardTradeUserStates.userId,
      data: cardTradeUserStates.data,
    })
    .from(cardTradeUserStates)
    .where(eq(cardTradeUserStates.eventId, event.id))

  const next = rows.map((row) => ({
    userId: row.userId,
    data: migrateState(row.data),
  }))

  if (!isSummerParty(event.slug)) return next

  const userIdsWithNewState = new Set(next.map((row) => row.userId))
  const legacyRows = await db
    .select({
      userId: userStates.userId,
      data: userStates.data,
    })
    .from(userStates)

  for (const row of legacyRows) {
    if (userIdsWithNewState.has(row.userId)) continue
    next.push({
      userId: row.userId,
      data: migrateState(row.data),
    })
  }

  return next
}

function buildTrendSummary(states: Array<{ data: AppState }>): TrendSummary {
  const given: Record<string, number> = {}
  const requested: Record<string, number> = {}
  let tradeCount = 0

  for (const row of states) {
    for (const trade of row.data.trades) {
      given[trade.givenCardId] = (given[trade.givenCardId] ?? 0) + 1
      if (trade.receivedCardId) {
        requested[trade.receivedCardId] = (requested[trade.receivedCardId] ?? 0) + 1
      }
      tradeCount += 1
    }
  }

  const toList = (map: Record<string, number>) =>
    Object.entries(map)
      .map(([cardId, count]) => ({ cardId, count }))
      .sort((a, b) => b.count - a.count)

  return {
    mostGiven: toList(given),
    mostRequested: toList(requested),
    tradeCount,
  }
}

function tierFromRank(rank: number, total: number): PopularityTier {
  if (total <= 0 || rank <= 0) return 'D'
  const pct = rank / total
  if (pct <= 0.05) return 'S'
  if (pct <= 0.15) return 'A'
  if (pct <= 0.35) return 'B'
  if (pct <= 0.6) return 'C'
  return 'D'
}

function buildCardStats(
  event: CardTradeEventDetail,
  states: Array<{ data: AppState }>,
  cardKey: string,
) {
  const given: Record<string, number> = {}
  const requested: Record<string, number> = {}

  for (const row of states) {
    for (const trade of row.data.trades) {
      given[trade.givenCardId] = (given[trade.givenCardId] ?? 0) + 1
      if (trade.receivedCardId) {
        requested[trade.receivedCardId] = (requested[trade.receivedCardId] ?? 0) + 1
      }
    }
  }

  const scores = new Map<string, number>()
  for (const card of event.cards) {
    scores.set(card.id, (given[card.id] ?? 0) + (requested[card.id] ?? 0))
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const total = ranked.length
  const rankIndex = ranked.findIndex(([id]) => id === cardKey)
  const rank = rankIndex >= 0 ? rankIndex + 1 : total
  const score = scores.get(cardKey) ?? 0
  const givenCount = given[cardKey] ?? 0
  const requestedCount = requested[cardKey] ?? 0

  return {
    cardId: cardKey,
    givenCount,
    requestedCount,
    score,
    rank: score > 0 ? rank : null,
    totalCards: total,
    tier: score > 0 ? tierFromRank(rank, total) : ('D' as PopularityTier),
  }
}

function newTradeId() {
  return randomId()
}

function randomId() {
  return generateShareSlug() + generateShareSlug()
}

function adjustOwned(owned: Record<string, number>, cardId: string, delta: number) {
  const next = { ...owned }
  const value = Math.max(0, (next[cardId] ?? 0) + delta)
  if (value === 0) delete next[cardId]
  else next[cardId] = value
  return next
}

function appendCompletedTrade(
  state: AppState,
  input: { givenCardId: string; receivedCardId?: string; partner?: string },
): AppState {
  const trade: TradeRecord = {
    id: newTradeId(),
    givenCardId: input.givenCardId,
    ...(input.receivedCardId ? { receivedCardId: input.receivedCardId } : {}),
    ...(input.partner ? { partner: input.partner } : {}),
    createdAt: new Date().toISOString(),
    source: 'completed',
  }
  return {
    ...state,
    trades: [trade, ...state.trades],
  }
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

    const cardIdParam = c.req.query('cardId')?.trim() || null
    const role = c.req.query('role')
    if (cardIdParam && role !== 'needed' && role !== 'owned') {
      return c.json({ error: 'role must be needed or owned when cardId is set' }, 400)
    }
    if (cardIdParam && !event.cards.some((card) => card.id === cardIdParam)) {
      return c.json({ error: 'Unknown card' }, 400)
    }

    let rows = await listSharedRows(db, event)
    if (cardIdParam && role === 'needed') {
      rows = rows.filter((row) => {
        const state = migrateState(row.data)
        return (state.neededBy[cardIdParam] ?? []).length > 0
      })
    } else if (cardIdParam && role === 'owned') {
      rows = rows.filter((row) => {
        const state = migrateState(row.data)
        return (state.owned[cardIdParam] ?? 0) > 0
      })
    }

    const collections = rows.map((row) => {
      const state = migrateState(row.data)
      const stats = computeCollectionStats(state.owned, state.neededBy)
      return {
        slug: row.shareSlug,
        username: row.username,
        acceptTradeOffers: row.acceptTradeOffers,
        updatedAt: row.updatedAt.toISOString(),
        stats: {
          uniqueOwned: stats.uniqueOwned,
          neededCount: stats.neededCount,
          tradeable: stats.tradeable,
          tradesToday: countCompletedTradesToday(state.trades),
          tradeAttemptsLeft: state.tradeAttemptsLeft ?? DAILY_TRADE_INITIATION_LIMIT,
        },
        event: {
          slug: event.slug,
          name: event.name,
          cardCount: event.cardCount,
        },
      }
    })

    return c.json({
      collections,
      filter:
        cardIdParam && (role === 'needed' || role === 'owned')
          ? { cardId: cardIdParam, role }
          : null,
    })
  })

  app.get('/:eventSlug/collections/:slug', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const slug = c.req.param('slug')
    const rows = await listSharedRows(db, event)
    const row = rows.find((item) => item.shareSlug === slug)
    if (!row) return c.json({ error: 'Collection not found' }, 404)

    return c.json({
      collection: toPublicPayload(
        row.shareSlug,
        row.username,
        row.acceptTradeOffers,
        row.data,
        row.updatedAt,
        event,
      ),
      event,
    })
  })

  app.use('/:eventSlug/trends', requireAuth)
  app.get('/:eventSlug/trends', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const states = await listTrendStates(db, event)
    return c.json({ trends: buildTrendSummary(states) })
  })

  app.get('/:eventSlug/cards/:cardId/stats', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const cardKey = c.req.param('cardId')
    if (!event.cards.some((card) => card.id === cardKey)) {
      return c.json({ error: 'Unknown card' }, 404)
    }

    const states = await listTrendStates(db, event)
    return c.json({ stats: buildCardStats(event, states, cardKey) })
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
      acceptTradeOffers: current?.acceptTradeOffers ?? true,
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
        slug: row?.shareSlug ?? '',
        acceptTradeOffers: row?.acceptTradeOffers ?? true,
      },
    })
  })

  app.put('/:eventSlug/share', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const user = c.get('user')!
    if (!user.uid) {
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

    const current = await loadEventState(db, event, user.id)
    let slug = current?.shareSlug ?? null
    if (parsed.data.enabled) {
      try {
        slug = await allocateShareSlug(db, event, user.id, user.uid, slug)
      } catch {
        return c.json({ error: 'Could not allocate share link' }, 500)
      }
    } else if (!slug) {
      slug = await allocateShareSlug(db, event, user.id, user.uid, null)
    }

    const acceptTradeOffers = parsed.data.acceptTradeOffers ?? current?.acceptTradeOffers ?? true
    await updateShareOnly(db, event, user.id, {
      enabled: parsed.data.enabled,
      slug,
      acceptTradeOffers,
    })
    return c.json({
      share: {
        enabled: parsed.data.enabled,
        slug,
        acceptTradeOffers,
      },
    })
  })

  // ─── P2P trade proposals ───────────────────────────────────────────────────

  type ProposalDto = {
    id: string
    type: 'trade' | 'gift'
    status: string
    offeredCardKey: string | null
    requestedCardKey: string
    createdAt: string
    updatedAt: string
    direction: 'incoming' | 'outgoing'
    counterparty: {
      username: string
      shareSlug: string | null
      uid: string | null
    }
  }

  async function resolveShareSlugForUser(
    event: CardTradeEventDetail,
    userId: string,
  ): Promise<string | null> {
    const row = await loadEventState(db, event, userId)
    return row?.shareEnabled ? row.shareSlug : row?.shareSlug ?? null
  }

  async function toProposalDto(
    event: CardTradeEventDetail,
    row: typeof cardTradeProposals.$inferSelect,
    viewerId: string,
  ): Promise<ProposalDto> {
    const direction: 'incoming' | 'outgoing' = row.toUserId === viewerId ? 'incoming' : 'outgoing'
    const counterpartyId = direction === 'incoming' ? row.fromUserId : row.toUserId
    const [counterparty] = await db
      .select({ username: users.username, uid: users.uid })
      .from(users)
      .where(eq(users.id, counterpartyId))
      .limit(1)
    const shareSlug = await resolveShareSlugForUser(event, counterpartyId)
    const revealUid = row.status === 'accepted'

    return {
      id: row.id,
      type: row.type as 'trade' | 'gift',
      status: row.status,
      offeredCardKey: row.offeredCardKey,
      requestedCardKey: row.requestedCardKey,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      direction,
      counterparty: {
        username: counterparty?.username ?? '?',
        shareSlug,
        uid: revealUid ? (counterparty?.uid ?? null) : null,
      },
    }
  }

  app.use('/:eventSlug/proposals', requireAuth)
  app.use('/:eventSlug/proposals/*', requireAuth)

  app.get('/:eventSlug/proposals', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const user = c.get('user')!
    const rows = await db
      .select()
      .from(cardTradeProposals)
      .where(
        and(
          eq(cardTradeProposals.eventId, event.id),
          or(eq(cardTradeProposals.fromUserId, user.id), eq(cardTradeProposals.toUserId, user.id)),
        ),
      )
      .orderBy(desc(cardTradeProposals.createdAt))

    const incoming: ProposalDto[] = []
    const outgoing: ProposalDto[] = []
    for (const row of rows) {
      const dto = await toProposalDto(event, row, user.id)
      if (dto.direction === 'incoming') incoming.push(dto)
      else outgoing.push(dto)
    }

    return c.json({ incoming, outgoing })
  })

  app.post('/:eventSlug/proposals', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const user = c.get('user')!
    const body = await c.req.json().catch(() => null)
    const schema = z.object({
      toShareSlug: z.string().trim().min(1).max(64),
      type: z.enum(['trade', 'gift']),
      offeredCardKey: z.string().trim().min(1).max(32).nullable().optional(),
      requestedCardKey: z.string().trim().min(1).max(32),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const { toShareSlug, type, requestedCardKey } = parsed.data
    const offeredCardKey = type === 'trade' ? (parsed.data.offeredCardKey ?? null) : null
    if (type === 'trade' && !offeredCardKey) {
      return c.json({ error: 'offeredCardKey is required for trade' }, 400)
    }
    if (!event.cards.some((card) => card.id === requestedCardKey)) {
      return c.json({ error: 'Unknown requested card' }, 400)
    }
    if (offeredCardKey && !event.cards.some((card) => card.id === offeredCardKey)) {
      return c.json({ error: 'Unknown offered card' }, 400)
    }

    const shared = await listSharedRows(db, event)
    const target = shared.find((row) => row.shareSlug === toShareSlug)
    if (!target) return c.json({ error: 'Collection not found' }, 404)
    if (target.userId === user.id) return c.json({ error: 'Cannot propose to yourself' }, 400)
    if (!target.acceptTradeOffers) {
      return c.json({ error: 'User does not accept trade offers' }, 403)
    }

    const fromState = migrateState(((await loadEventState(db, event, user.id))?.data ?? EMPTY_STATE) as AppState)
    if (type === 'trade') {
      if ((fromState.owned[offeredCardKey!] ?? 0) < 1) {
        return c.json({ error: 'You do not own the offered card' }, 400)
      }
    }
    if ((migrateState(target.data).owned[requestedCardKey] ?? 0) < 1 && type === 'trade') {
      // still allow gift/trade request for cards they might have — for trade they need the card
    }
    if ((migrateState(target.data).owned[requestedCardKey] ?? 0) < 1) {
      return c.json({ error: 'Target does not own the requested card' }, 400)
    }

    const pendingSame = await db
      .select()
      .from(cardTradeProposals)
      .where(
        and(
          eq(cardTradeProposals.eventId, event.id),
          eq(cardTradeProposals.fromUserId, user.id),
          eq(cardTradeProposals.toUserId, target.userId),
          eq(cardTradeProposals.status, 'pending'),
        ),
      )
    const dup = pendingSame.find(
      (p) =>
        p.type === type &&
        p.requestedCardKey === requestedCardKey &&
        (p.offeredCardKey ?? null) === (offeredCardKey ?? null),
    )
    if (dup) {
      return c.json({ error: 'Identical pending proposal already exists' }, 409)
    }

    const [created] = await db
      .insert(cardTradeProposals)
      .values({
        eventId: event.id,
        fromUserId: user.id,
        toUserId: target.userId,
        type,
        offeredCardKey,
        requestedCardKey,
        status: 'pending',
      })
      .returning()

    return c.json({ proposal: await toProposalDto(event, created!, user.id) }, 201)
  })

  app.post('/:eventSlug/proposals/:id/accept', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const user = c.get('user')!
    const id = c.req.param('id')
    const [proposal] = await db
      .select()
      .from(cardTradeProposals)
      .where(and(eq(cardTradeProposals.id, id), eq(cardTradeProposals.eventId, event.id)))
      .limit(1)

    if (!proposal) return c.json({ error: 'Proposal not found' }, 404)
    if (proposal.toUserId !== user.id) return c.json({ error: 'Only recipient can accept' }, 403)
    if (proposal.status !== 'pending') return c.json({ error: 'Proposal is not pending' }, 409)

    const toShare = await loadEventState(db, event, user.id)
    if (toShare && !toShare.acceptTradeOffers) {
      return c.json({ error: 'You are not accepting trade offers' }, 403)
    }

    const fromRow = await loadEventState(db, event, proposal.fromUserId)
    const toRow = await loadEventState(db, event, proposal.toUserId)
    let fromState = migrateState((fromRow?.data ?? EMPTY_STATE) as AppState)
    let toState = migrateState((toRow?.data ?? EMPTY_STATE) as AppState)

    const [fromUser] = await db
      .select({ username: users.username, uid: users.uid })
      .from(users)
      .where(eq(users.id, proposal.fromUserId))
      .limit(1)
    const [toUser] = await db
      .select({ username: users.username, uid: users.uid })
      .from(users)
      .where(eq(users.id, proposal.toUserId))
      .limit(1)

    if (proposal.type === 'trade') {
      const offered = proposal.offeredCardKey!
      if ((fromState.owned[offered] ?? 0) < 1) {
        return c.json({ error: 'Sender no longer owns the offered card' }, 409)
      }
      if ((toState.owned[proposal.requestedCardKey] ?? 0) < 1) {
        return c.json({ error: 'You no longer own the requested card' }, 409)
      }
      fromState = {
        ...fromState,
        owned: adjustOwned(adjustOwned(fromState.owned, offered, -1), proposal.requestedCardKey, 1),
      }
      toState = {
        ...toState,
        owned: adjustOwned(adjustOwned(toState.owned, proposal.requestedCardKey, -1), offered, 1),
      }
      fromState = appendCompletedTrade(fromState, {
        givenCardId: offered,
        receivedCardId: proposal.requestedCardKey,
        partner: toUser?.username,
      })
      toState = appendCompletedTrade(toState, {
        givenCardId: proposal.requestedCardKey,
        receivedCardId: offered,
        partner: fromUser?.username,
      })
    } else {
      if ((toState.owned[proposal.requestedCardKey] ?? 0) < 1) {
        return c.json({ error: 'You no longer own the requested card' }, 409)
      }
      toState = {
        ...toState,
        owned: adjustOwned(toState.owned, proposal.requestedCardKey, -1),
      }
      fromState = {
        ...fromState,
        owned: adjustOwned(fromState.owned, proposal.requestedCardKey, 1),
      }
      // Gift: to gives the card away; from receives it. Only the giver logs a trade
      // so trends do not count the gift as "given" by the requester.
      toState = appendCompletedTrade(toState, {
        givenCardId: proposal.requestedCardKey,
        partner: fromUser?.username,
      })
    }

    await upsertEventState(db, event, proposal.fromUserId, fromState, {
      enabled: fromRow?.shareEnabled ?? false,
      slug: fromRow?.shareSlug ?? null,
      acceptTradeOffers: fromRow?.acceptTradeOffers ?? true,
    })
    await upsertEventState(db, event, proposal.toUserId, toState, {
      enabled: toRow?.shareEnabled ?? false,
      slug: toRow?.shareSlug ?? null,
      acceptTradeOffers: toRow?.acceptTradeOffers ?? true,
    })

    const [updated] = await db
      .update(cardTradeProposals)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(cardTradeProposals.id, proposal.id))
      .returning()

    return c.json({ proposal: await toProposalDto(event, updated!, user.id) })
  })

  app.post('/:eventSlug/proposals/:id/reject', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const user = c.get('user')!
    const id = c.req.param('id')
    const [proposal] = await db
      .select()
      .from(cardTradeProposals)
      .where(and(eq(cardTradeProposals.id, id), eq(cardTradeProposals.eventId, event.id)))
      .limit(1)

    if (!proposal) return c.json({ error: 'Proposal not found' }, 404)
    if (proposal.toUserId !== user.id) return c.json({ error: 'Only recipient can reject' }, 403)
    if (proposal.status !== 'pending') return c.json({ error: 'Proposal is not pending' }, 409)

    const [updated] = await db
      .update(cardTradeProposals)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(cardTradeProposals.id, proposal.id))
      .returning()

    return c.json({ proposal: await toProposalDto(event, updated!, user.id) })
  })

  app.post('/:eventSlug/proposals/:id/cancel', async (c) => {
    const event = await loadEventOr404(c, db)
    if (!event) return c.json({ error: 'Event not found' }, 404)

    const user = c.get('user')!
    const id = c.req.param('id')
    const [proposal] = await db
      .select()
      .from(cardTradeProposals)
      .where(and(eq(cardTradeProposals.id, id), eq(cardTradeProposals.eventId, event.id)))
      .limit(1)

    if (!proposal) return c.json({ error: 'Proposal not found' }, 404)
    if (proposal.fromUserId !== user.id) return c.json({ error: 'Only sender can cancel' }, 403)
    if (proposal.status !== 'pending') return c.json({ error: 'Proposal is not pending' }, 409)

    const [updated] = await db
      .update(cardTradeProposals)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(cardTradeProposals.id, proposal.id))
      .returning()

    return c.json({ proposal: await toProposalDto(event, updated!, user.id) })
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
