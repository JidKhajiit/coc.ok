import type { AppState, FavoriteFolder, TradeRecord, TradeSource } from './types.js'
import { DAILY_TRADE_INITIATION_LIMIT, DEFAULT_FAVORITE_FOLDERS, SOLO_FOLDER_ID } from './types.js'

const TRADE_SOURCES: TradeSource[] = ['completed', 'observed', 'cancelled']
const MAX_CARD_NUMBER = 135

type LegacyState = Partial<AppState> & {
  wishlist?: string[]
  /** @deprecated legacy star folders */
  accounts?: FavoriteFolder[]
}

function normalizeLocale(value: unknown): 'ru' | 'en' {
  return value === 'en' ? 'en' : 'ru'
}

function normalizeTradeAttemptsLeft(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(DAILY_TRADE_INITIATION_LIMIT, Math.floor(value)))
  }
  return DAILY_TRADE_INITIATION_LIMIT
}

function normalizeTradeSource(source: unknown): TradeSource {
  return TRADE_SOURCES.includes(source as TradeSource)
    ? (source as TradeSource)
    : 'completed'
}

function numberFromCardId(id: string): number | null {
  const nFormat = /^n(\d+)$/i.exec(id)
  if (nFormat) return Number(nFormat[1])

  const legacy = /^t\d+-(\d+)-(?:blue|gold)$/i.exec(id)
  if (legacy) return Number(legacy[1])

  const plain = /^(\d+)$/.exec(id)
  if (plain) return Number(plain[1])

  return null
}

function migrateCardId(id: string): string | null {
  const num = numberFromCardId(id)
  if (num == null || num < 1 || num > MAX_CARD_NUMBER) return null
  return `n${num}`
}

function migrateTradeLike<T extends { givenCardId: string; receivedCardId?: string }>(
  items: T[] | undefined,
): T[] {
  const result: T[] = []
  for (const t of items ?? []) {
    const givenCardId = migrateCardId(t.givenCardId)
    if (!givenCardId) continue
    const receivedRaw = t.receivedCardId
    const receivedCardId = receivedRaw ? migrateCardId(receivedRaw) ?? undefined : undefined
    if (receivedRaw && !receivedCardId) continue
    result.push({ ...t, givenCardId, receivedCardId })
  }
  return result
}

function migrateTrades(items: TradeRecord[] | undefined): TradeRecord[] {
  return migrateTradeLike(items).map((t) => ({
    ...t,
    source: normalizeTradeSource(t.source),
  }))
}

function normalizeFolders(parsed: LegacyState): FavoriteFolder[] {
  const raw = Array.isArray(parsed.favoriteFolders)
    ? parsed.favoriteFolders
    : Array.isArray(parsed.accounts)
      ? parsed.accounts
      : null

  if (raw) {
    return raw
      .filter((a): a is FavoriteFolder => Boolean(a?.id && String(a.name ?? '').trim()))
      .map((a) => ({ id: a.id, name: String(a.name).trim() }))
  }

  if (parsed.wishlist?.length) {
    return [
      { id: 'a1', name: 'Акк 1' },
      { id: 'a2', name: 'Акк 2' },
      { id: 'a3', name: 'Акк 3' },
    ]
  }

  return DEFAULT_FAVORITE_FOLDERS
}

export function migrateState(parsed: LegacyState): AppState {
  const owned: Record<string, number> = {}
  for (const [id, qty] of Object.entries(parsed.owned ?? {})) {
    const next = migrateCardId(id)
    if (!next || qty <= 0) continue
    owned[next] = (owned[next] ?? 0) + qty
  }

  const favoriteFolders = normalizeFolders(parsed)
  const folderIds = new Set(favoriteFolders.map((a) => a.id))
  const neededBy: Record<string, string[]> = {}

  for (const [id, accs] of Object.entries(parsed.neededBy ?? {})) {
    const cardId = migrateCardId(id)
    if (!cardId || !(accs ?? []).length) continue
    if (favoriteFolders.length === 0) {
      neededBy[cardId] = [SOLO_FOLDER_ID]
      continue
    }
    const list = [
      ...new Set((accs ?? []).filter((a) => folderIds.has(a) || a === SOLO_FOLDER_ID)),
    ]
    if (list.length === 0 && (accs ?? []).includes(SOLO_FOLDER_ID)) {
      neededBy[cardId] = [favoriteFolders[0]!.id]
    } else if (list.filter((a) => a !== SOLO_FOLDER_ID).length) {
      neededBy[cardId] = list.filter((a) => a !== SOLO_FOLDER_ID)
    } else if (list.length) {
      neededBy[cardId] = [favoriteFolders[0]!.id]
    }
  }

  for (const id of parsed.wishlist ?? []) {
    const cardId = migrateCardId(id)
    if (!cardId) continue
    neededBy[cardId] =
      favoriteFolders.length > 0 ? favoriteFolders.map((a) => a.id) : [SOLO_FOLDER_ID]
  }

  return {
    owned,
    neededBy,
    favoriteFolders,
    trades: migrateTrades(parsed.trades),
    potentialTrades: migrateTradeLike(parsed.potentialTrades),
    locale: normalizeLocale(parsed.locale),
    tradeAttemptsLeft: normalizeTradeAttemptsLeft(parsed.tradeAttemptsLeft),
  }
}

export function isEmptyState(state: AppState): boolean {
  return (
    Object.keys(state.owned).length === 0 &&
    Object.keys(state.neededBy).length === 0 &&
    state.favoriteFolders.length === 0 &&
    state.trades.length === 0 &&
    state.potentialTrades.length === 0
  )
}
