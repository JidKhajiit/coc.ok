export type TradeSource = 'completed' | 'observed' | 'cancelled'

export interface Account {
  id: string
  name: string
}

export interface TradeRecord {
  id: string
  givenCardId: string
  receivedCardId?: string
  partner?: string
  note?: string
  createdAt: string
  source?: TradeSource
}

export interface PotentialTrade {
  id: string
  givenCardId: string
  receivedCardId?: string
  partner?: string
  note?: string
  createdAt: string
}

export interface AppState {
  owned: Record<string, number>
  neededBy: Record<string, string[]>
  accounts: Account[]
  trades: TradeRecord[]
  potentialTrades: PotentialTrade[]
  locale?: 'ru' | 'en'
  wishlist?: string[]
  /** Remaining in-game trade initiations (manual tracker, daily cap 3). */
  tradeAttemptsLeft?: number
}

export const DEFAULT_ACCOUNTS: Account[] = []
export const SOLO_ACCOUNT_ID = 'solo'

/** Daily trades that grant a bonus star. */
export const DAILY_BONUS_TRADE_LIMIT = 20

/** Daily trade initiations allowed in-game. */
export const DAILY_TRADE_INITIATION_LIMIT = 3

export const EMPTY_STATE: AppState = {
  owned: {},
  neededBy: {},
  accounts: DEFAULT_ACCOUNTS,
  trades: [],
  potentialTrades: [],
  locale: 'ru',
  tradeAttemptsLeft: DAILY_TRADE_INITIATION_LIMIT,
}
