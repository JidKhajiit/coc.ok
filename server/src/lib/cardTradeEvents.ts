import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import {
  cardTradeCards,
  cardTradeEvents,
  cardTradeSets,
} from '../db/schema.js'
import {
  DEFAULT_CARD_TRADE_EVENT,
  type CardTradeCard,
  type CardTradeColor,
  type CardTradeEventSeed,
  type CardTradeRarity,
  type CardTradeSet,
} from '../../../shared/cardTradeCatalog.js'

export type CardTradeEventSummary = {
  id: string
  slug: string
  name: string
  startDate: string
  endDate: string
  active: boolean
  cardCount: number
  setCount: number
}

export type CardTradeEventDetail = CardTradeEventSummary & {
  sets: CardTradeSet[]
  cards: CardTradeCard[]
}

type EventRow = typeof cardTradeEvents.$inferSelect

export async function ensureDefaultCardTradeEvent(db: Db) {
  const eventId = await ensureCardTradeEventSeed(db, DEFAULT_CARD_TRADE_EVENT)
  await backfillDefaultCardTradeEventNames(db, eventId)
}

export async function ensureCardTradeEventSeed(db: Db, seed: CardTradeEventSeed) {
  const [existing] = await db
    .select({ id: cardTradeEvents.id })
    .from(cardTradeEvents)
    .where(eq(cardTradeEvents.slug, seed.slug))
    .limit(1)

  if (existing) return existing.id

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(cardTradeEvents)
      .values({
        slug: seed.slug,
        name: seed.name,
        startDate: seed.startDate,
        endDate: seed.endDate,
        active: seed.active,
      })
      .returning({ id: cardTradeEvents.id })

    if (!created) throw new Error(`Failed to create event ${seed.slug}`)

    await tx.insert(cardTradeSets).values(
      seed.sets.map((set, index) => ({
        eventId: created.id,
        slug: set.id,
        name: set.name,
        fromNumber: set.from,
        toNumber: set.to,
        sortOrder: index,
      })),
    )

    await tx.insert(cardTradeCards).values(
      seed.cards.map((card) => ({
        eventId: created.id,
        cardKey: card.id,
        number: card.number,
        name: card.name,
        rarity: card.rarity,
        color: card.color,
        setSlug: card.setId,
        unknownName: Boolean(card.unknownName),
      })),
    )

    return created.id
  })
}

async function backfillDefaultCardTradeEventNames(db: Db, eventId: string) {
  const byCardKey = new Map(
    DEFAULT_CARD_TRADE_EVENT.cards
      .filter((card) => !card.unknownName)
      .map((card) => [card.id, card.name]),
  )

  const existingUnknownCards = await db
    .select({
      id: cardTradeCards.id,
      cardKey: cardTradeCards.cardKey,
    })
    .from(cardTradeCards)
    .where(and(eq(cardTradeCards.eventId, eventId), eq(cardTradeCards.unknownName, true)))

  for (const row of existingUnknownCards) {
    const name = byCardKey.get(row.cardKey)
    if (!name) continue
    await db
      .update(cardTradeCards)
      .set({
        name,
        unknownName: false,
      })
      .where(eq(cardTradeCards.id, row.id))
  }
}

function mapEventSummary(
  event: EventRow,
  sets: CardTradeSet[],
  cards: CardTradeCard[],
): CardTradeEventSummary {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    startDate: event.startDate,
    endDate: event.endDate,
    active: event.active,
    setCount: sets.length,
    cardCount: cards.length,
  }
}

export async function getCardTradeEventBySlug(
  db: Db,
  slug: string,
): Promise<CardTradeEventDetail | null> {
  const [event] = await db
    .select()
    .from(cardTradeEvents)
    .where(eq(cardTradeEvents.slug, slug))
    .limit(1)
  if (!event) return null

  const [setsRows, cardRows] = await Promise.all([
    db
      .select()
      .from(cardTradeSets)
      .where(eq(cardTradeSets.eventId, event.id))
      .orderBy(asc(cardTradeSets.sortOrder), asc(cardTradeSets.fromNumber)),
    db
      .select()
      .from(cardTradeCards)
      .where(eq(cardTradeCards.eventId, event.id))
      .orderBy(asc(cardTradeCards.number)),
  ])

  const sets: CardTradeSet[] = setsRows.map((set) => ({
    id: set.slug,
    name: set.name,
    from: set.fromNumber,
    to: set.toNumber,
  }))
  const setBySlug = new Map(sets.map((set) => [set.id, set]))
  const cards: CardTradeCard[] = cardRows.map((card) => {
    const set = setBySlug.get(card.setSlug)
    if (!set) {
      throw new Error(`Card ${card.cardKey} refers to missing set ${card.setSlug}`)
    }
    return {
      id: card.cardKey,
      name: card.name,
      number: card.number,
      rarity: card.rarity as CardTradeRarity,
      color: card.color as CardTradeColor,
      setId: set.id,
      setName: set.name,
      ...(card.unknownName ? { unknownName: true } : {}),
    }
  })

  return {
    ...mapEventSummary(event, sets, cards),
    sets,
    cards,
  }
}

export async function listCardTradeEvents(db: Db): Promise<CardTradeEventSummary[]> {
  const events = await db
    .select()
    .from(cardTradeEvents)
    .orderBy(asc(cardTradeEvents.startDate), asc(cardTradeEvents.createdAt))

  const details = await Promise.all(events.map((event) => getCardTradeEventBySlug(db, event.slug)))
  return details.filter(Boolean).map((event) => ({
    id: event!.id,
    slug: event!.slug,
    name: event!.name,
    startDate: event!.startDate,
    endDate: event!.endDate,
    active: event!.active,
    setCount: event!.setCount,
    cardCount: event!.cardCount,
  }))
}

export async function createCardTradeEvent(
  db: Db,
  seed: CardTradeEventSeed,
): Promise<CardTradeEventDetail> {
  const existing = await getCardTradeEventBySlug(db, seed.slug)
  if (existing) {
    throw new Error('Event slug already exists')
  }

  const eventId = await ensureCardTradeEventSeed(db, seed)
  const detail = await getCardTradeEventBySlug(db, seed.slug)
  if (!detail || detail.id !== eventId) {
    const fallback = await getCardTradeEventBySlug(db, seed.slug)
    if (!fallback) throw new Error(`Failed to load created event ${seed.slug}`)
    return fallback
  }
  return detail
}

export async function updateCardTradeEvent(
  db: Db,
  eventId: string,
  seed: Omit<CardTradeEventSeed, 'slug'>,
): Promise<CardTradeEventDetail> {
  const [existing] = await db
    .select({ id: cardTradeEvents.id, slug: cardTradeEvents.slug })
    .from(cardTradeEvents)
    .where(eq(cardTradeEvents.id, eventId))
    .limit(1)

  if (!existing) {
    throw new Error('Event not found')
  }

  await db.transaction(async (tx) => {
    await tx
      .update(cardTradeEvents)
      .set({
        name: seed.name,
        startDate: seed.startDate,
        endDate: seed.endDate,
        active: seed.active,
      })
      .where(eq(cardTradeEvents.id, eventId))

    await tx.delete(cardTradeSets).where(eq(cardTradeSets.eventId, eventId))
    await tx.delete(cardTradeCards).where(eq(cardTradeCards.eventId, eventId))

    await tx.insert(cardTradeSets).values(
      seed.sets.map((set, index) => ({
        eventId,
        slug: set.id,
        name: set.name,
        fromNumber: set.from,
        toNumber: set.to,
        sortOrder: index,
      })),
    )

    await tx.insert(cardTradeCards).values(
      seed.cards.map((card) => ({
        eventId,
        cardKey: card.id,
        number: card.number,
        name: card.name,
        rarity: card.rarity,
        color: card.color,
        setSlug: card.setId,
        unknownName: Boolean(card.unknownName),
      })),
    )
  })

  const detail = await getCardTradeEventBySlug(db, existing.slug)
  if (!detail) throw new Error('Failed to load updated event')
  return detail
}
