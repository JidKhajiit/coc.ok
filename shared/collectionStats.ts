import type { AppState } from './types.js'

/** Aggregated collection counters for hero / public share. */
export function computeCollectionStats(
  owned: Record<string, number>,
  neededBy: Record<string, string[]>,
  reservedByCard: Record<string, number> = {},
) {
  const ownedIds = Object.keys(owned).filter((id) => (owned[id] ?? 0) > 0)
  let tradeable = 0
  let totalCopies = 0
  for (const [id, qty] of Object.entries(owned)) {
    if (qty <= 0) continue
    totalCopies += qty
    const reserved = reservedByCard[id] ?? 0
    tradeable += Math.max(0, qty - 1 - reserved)
  }
  const neededCount = Object.keys(neededBy).filter((id) => (neededBy[id] ?? []).length > 0).length
  return {
    uniqueOwned: ownedIds.length,
    totalCopies,
    tradeable,
    neededCount,
  }
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
    state.potentialTrades.length === 0
  )
}
