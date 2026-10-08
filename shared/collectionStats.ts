import type { AppState, CardTradeOffer } from './types.js'
import { effectiveDisposition, reservedByCardFromState, tradeableQty } from './tradeOffers.js'

const TRADE_LIKE = new Set(['trade', 'surcharge'])

/** Aggregated collection counters for hero / public share. */
export function computeCollectionStats(
  owned: Record<string, number>,
  neededBy: Record<string, string[]>,
  reservedByCard: Record<string, number> = {},
  tradeOffers: Record<string, CardTradeOffer> = {},
) {
  const ownedIds = Object.keys(owned).filter((id) => (owned[id] ?? 0) > 0)
  let tradeable = 0
  let totalCopies = 0
  for (const [id, qty] of Object.entries(owned)) {
    if (qty <= 0) continue
    totalCopies += qty
    // «на обмен» = trade/surcharge only; gift is a separate role
    if (!TRADE_LIKE.has(effectiveDisposition(tradeOffers[id]))) continue
    const reserved = reservedByCard[id] ?? 0
    tradeable += tradeableQty(qty, reserved)
  }
  const neededCount = Object.keys(neededBy).filter((id) => (neededBy[id] ?? []).length > 0).length
  return {
    uniqueOwned: ownedIds.length,
    totalCopies,
    tradeable,
    neededCount,
  }
}

/** Convenience when full AppState is available. */
export function computeCollectionStatsFromState(state: AppState) {
  return computeCollectionStats(
    state.owned,
    state.neededBy,
    reservedByCardFromState(state),
    state.tradeOffers ?? {},
  )
}

export function collectionPercent(uniqueOwned: number, totalCards: number): number {
  return totalCards > 0 ? Math.round((uniqueOwned / totalCards) * 100) : 0
}

export function emptyAppStateLike(state: AppState): boolean {
  return (
    Object.keys(state.owned).length === 0 &&
    Object.keys(state.neededBy).length === 0 &&
    state.favoriteFolders.length === 0 &&
    state.trades.length === 0 &&
    state.potentialTrades.length === 0 &&
    Object.keys(state.tradeOffers ?? {}).length === 0
  )
}
