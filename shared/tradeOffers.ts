import type { AppState, CardTradeOffer, ExtraDisposition, TradeWant } from './types.js'

const DISPOSITIONS: ExtraDisposition[] = ['keep', 'trade', 'surcharge', 'gift']
const WANTS: TradeWant[] = ['any', 'equal_or_more', 'specific']
const OFFERABLE: ReadonlySet<ExtraDisposition> = new Set(['trade', 'surcharge', 'gift'])

export type CardLike = {
  id: string
  number: number
  rarity: number
}

export function effectiveDisposition(offer: CardTradeOffer | undefined | null): ExtraDisposition {
  return offer?.disposition ?? 'trade'
}

export function effectiveWant(offer: CardTradeOffer | undefined | null): TradeWant {
  const disposition = effectiveDisposition(offer)
  if (disposition !== 'trade' && disposition !== 'surcharge') return 'any'
  return offer?.want ?? 'any'
}

export function reservedByCardFromState(state: Pick<AppState, 'potentialTrades'>): Record<string, number> {
  const map: Record<string, number> = {}
  for (const t of state.potentialTrades) {
    map[t.givenCardId] = (map[t.givenCardId] ?? 0) + 1
  }
  return map
}

export function tradeableQty(
  ownedQty: number,
  reserved: number,
): number {
  return Math.max(0, ownedQty - 1 - reserved)
}

/** Spare copies available and not marked keep. */
export function isCardOfferedForTrade(
  state: Pick<AppState, 'owned' | 'potentialTrades' | 'tradeOffers'>,
  cardId: string,
): boolean {
  const qty = state.owned[cardId] ?? 0
  const reserved = reservedByCardFromState(state)[cardId] ?? 0
  if (tradeableQty(qty, reserved) < 1) return false
  const disposition = effectiveDisposition(state.tradeOffers?.[cardId])
  return OFFERABLE.has(disposition)
}

/** Aligns with wishlist: ×0, ♥, or given in a potential trade without a spare. */
export function isCardNeededInCollection(
  state: Pick<AppState, 'owned' | 'neededBy' | 'potentialTrades'>,
  cardId: string,
): boolean {
  if ((state.owned[cardId] ?? 0) === 0) return true
  if ((state.neededBy[cardId] ?? []).length > 0) return true
  for (const t of state.potentialTrades) {
    if (t.givenCardId === cardId && (state.owned[cardId] ?? 0) <= 1) return true
  }
  return false
}

export function parseSpecificCardNumbers(
  text: string,
  cards: CardLike[],
): { ids: string[]; invalidTokens: string[] } {
  const byNumber = new Map(cards.map((c) => [c.number, c.id]))
  const ids = new Set<string>()
  const invalidTokens: string[] = []
  const tokens = text.trim().split(/[\s,;]+/).filter(Boolean)

  for (const token of tokens) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(token)
    if (range) {
      const from = Number(range[1])
      const to = Number(range[2])
      if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
        invalidTokens.push(token)
        continue
      }
      let any = false
      for (let n = from; n <= to; n += 1) {
        const id = byNumber.get(n)
        if (id) {
          ids.add(id)
          any = true
        }
      }
      if (!any) invalidTokens.push(token)
      continue
    }

    if (!/^\d+$/.test(token)) {
      invalidTokens.push(token)
      continue
    }
    const id = byNumber.get(Number(token))
    if (!id) {
      invalidTokens.push(token)
      continue
    }
    ids.add(id)
  }

  return { ids: [...ids], invalidTokens }
}

export function formatSpecificCardNumbers(ids: string[], cards: CardLike[]): string {
  const byId = new Map(cards.map((c) => [c.id, c.number]))
  return ids
    .map((id) => byId.get(id))
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b)
    .join(' ')
}

/** Whether an offered card satisfies the owner's want for the card they give away. */
export function wantAccepts(
  offer: CardTradeOffer | undefined | null,
  givenCard: CardLike,
  receivedCard: CardLike,
): boolean {
  const disposition = effectiveDisposition(offer)
  if (disposition === 'keep') return false
  if (disposition === 'gift') return true

  const want = effectiveWant(offer)
  if (want === 'any') return true
  if (want === 'equal_or_more') return receivedCard.rarity >= givenCard.rarity
  const specific = offer?.specificCardIds ?? []
  return specific.includes(receivedCard.id)
}

export function isExtraDisposition(value: unknown): value is ExtraDisposition {
  return typeof value === 'string' && DISPOSITIONS.includes(value as ExtraDisposition)
}

export function isTradeWant(value: unknown): value is TradeWant {
  return typeof value === 'string' && WANTS.includes(value as TradeWant)
}

export function normalizeCardTradeOffer(raw: unknown): CardTradeOffer | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (!isExtraDisposition(obj.disposition)) return null

  const offer: CardTradeOffer = { disposition: obj.disposition }
  if (obj.disposition === 'trade' || obj.disposition === 'surcharge') {
    if (isTradeWant(obj.want)) offer.want = obj.want
    else offer.want = 'any'

    if (offer.want === 'specific' && Array.isArray(obj.specificCardIds)) {
      const ids = [
        ...new Set(
          obj.specificCardIds.filter(
            (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 32,
          ),
        ),
      ]
      if (ids.length) offer.specificCardIds = ids
    }
  }
  return offer
}
