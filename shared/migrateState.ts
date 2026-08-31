import type { Account, AppState, TradeRecord, TradeSource } from './types.js'
import { DEFAULT_ACCOUNTS, SOLO_ACCOUNT_ID } from './types.js'

const TRADE_SOURCES: TradeSource[] = ['completed', 'observed', 'cancelled']
const MAX_CARD_NUMBER = 135

function normalizeLocale(value: unknown): 'ru' | 'en' {
  return value === 'en' ? 'en' : 'ru'
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

export function migrateState(parsed: Partial<AppState> & { wishlist?: string[] }): AppState {
  const owned: Record<string, number> = {}
  for (const [id, qty] of Object.entries(parsed.owned ?? {})) {
    const next = migrateCardId(id)
    if (!next || qty <= 0) continue
    owned[next] = (owned[next] ?? 0) + qty
  }

  const accounts: Account[] = Array.isArray(parsed.accounts)
    ? parsed.accounts
        .filter((a): a is Account => Boolean(a?.id && String(a.name ?? '').trim()))
        .map((a) => ({ id: a.id, name: String(a.name).trim() }))
    : parsed.wishlist?.length
      ? [
          { id: 'a1', name: 'Акк 1' },
          { id: 'a2', name: 'Акк 2' },
          { id: 'a3', name: 'Акк 3' },
        ]
      : DEFAULT_ACCOUNTS

  const accountIds = new Set(accounts.map((a) => a.id))
  const neededBy: Record<string, string[]> = {}

  for (const [id, accs] of Object.entries(parsed.neededBy ?? {})) {
    const cardId = migrateCardId(id)
    if (!cardId || !(accs ?? []).length) continue
    if (accounts.length === 0) {
      neededBy[cardId] = [SOLO_ACCOUNT_ID]
      continue
    }
    const list = [...new Set((accs ?? []).filter((a) => accountIds.has(a) || a === SOLO_ACCOUNT_ID))]
    if (list.length === 0 && (accs ?? []).includes(SOLO_ACCOUNT_ID)) {
      neededBy[cardId] = [accounts[0]!.id]
    } else if (list.filter((a) => a !== SOLO_ACCOUNT_ID).length) {
      neededBy[cardId] = list.filter((a) => a !== SOLO_ACCOUNT_ID)
    } else if (list.length) {
      neededBy[cardId] = [accounts[0]!.id]
    }
  }

  for (const id of parsed.wishlist ?? []) {
    const cardId = migrateCardId(id)
    if (!cardId) continue
    neededBy[cardId] =
      accounts.length > 0 ? accounts.map((a) => a.id) : [SOLO_ACCOUNT_ID]
  }

  return {
    owned,
    neededBy,
    accounts,
    trades: migrateTrades(parsed.trades),
    potentialTrades: migrateTradeLike(parsed.potentialTrades),
    locale: normalizeLocale(parsed.locale),
  }
}

export function isEmptyState(state: AppState): boolean {
  return (
    Object.keys(state.owned).length === 0 &&
    Object.keys(state.neededBy).length === 0 &&
    state.accounts.length === 0 &&
    state.trades.length === 0 &&
    state.potentialTrades.length === 0
  )
}
