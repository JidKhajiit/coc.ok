import type { AppState } from './types.js'
import {
  isCardNeededInCollection,
  isCardOffered,
  isCardOfferedAsGift,
  isCardOfferedForTrade,
  tradeableQty,
  reservedByCardFromState,
  effectiveDisposition,
} from './tradeOffers.js'

export type CollectionMatchRole = 'needed' | 'trade' | 'gift'

/** Card ids offered (trade or gift) and needed in a public collection. */
export function collectionMatchCardIds(state: AppState): {
  offeredCardIds: string[]
  neededCardIds: string[]
} {
  const offeredCardIds: string[] = []
  const neededCardIds: string[] = []
  const cardIds = new Set([
    ...Object.keys(state.owned),
    ...Object.keys(state.neededBy),
    ...Object.keys(state.tradeOffers ?? {}),
  ])
  for (const t of state.potentialTrades) {
    cardIds.add(t.givenCardId)
  }

  for (const cardId of cardIds) {
    if (isCardOffered(state, cardId)) offeredCardIds.push(cardId)
    if (isCardNeededInCollection(state, cardId)) neededCardIds.push(cardId)
  }
  return { offeredCardIds, neededCardIds }
}

export function filterCollectionByRole(
  state: AppState,
  cardId: string,
  role: CollectionMatchRole,
): boolean {
  if (role === 'needed') return isCardNeededInCollection(state, cardId)
  if (role === 'trade') return isCardOfferedForTrade(state, cardId)
  return isCardOfferedAsGift(state, cardId)
}

/** Viewer cards marked needed (wishlist / missing). */
export function viewerNeededCardIds(state: AppState): Set<string> {
  const ids = new Set<string>()
  for (const cardId of Object.keys(state.neededBy)) {
    if ((state.neededBy[cardId] ?? []).length > 0) ids.add(cardId)
  }
  for (const [cardId, qty] of Object.entries(state.owned)) {
    if (qty === 0) ids.add(cardId)
  }
  for (const t of state.potentialTrades) {
    if ((state.owned[t.givenCardId] ?? 0) <= 1) ids.add(t.givenCardId)
  }
  return ids
}

/** Viewer cards with spare copies available for trade/gift. */
export function viewerTradeableCardIds(state: AppState): Set<string> {
  const reserved = reservedByCardFromState(state)
  const ids = new Set<string>()
  for (const [cardId, qty] of Object.entries(state.owned)) {
    if (effectiveDisposition(state.tradeOffers?.[cardId]) === 'keep') continue
    if (tradeableQty(qty, reserved[cardId] ?? 0) >= 1) ids.add(cardId)
  }
  return ids
}

/**
 * Match priority for sorting (lower = better):
 * 0 mutual, 1 they have what I need, 2 they need what I can give, 3 other.
 */
export function collectionMatchTier(
  theirOffered: ReadonlySet<string> | readonly string[],
  theirNeeded: ReadonlySet<string> | readonly string[],
  myNeeded: ReadonlySet<string>,
  myTradeable: ReadonlySet<string>,
): number {
  const offered = theirOffered instanceof Set ? theirOffered : new Set(theirOffered)
  const needed = theirNeeded instanceof Set ? theirNeeded : new Set(theirNeeded)

  let hasWhatINeed = false
  for (const id of myNeeded) {
    if (offered.has(id)) {
      hasWhatINeed = true
      break
    }
  }

  let wantsWhatIHave = false
  for (const id of myTradeable) {
    if (needed.has(id)) {
      wantsWhatIHave = true
      break
    }
  }

  if (hasWhatINeed && wantsWhatIHave) return 0
  if (hasWhatINeed) return 1
  if (wantsWhatIHave) return 2
  return 3
}
