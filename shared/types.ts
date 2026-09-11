export type TradeSource = 'completed' | 'observed' | 'cancelled'

export interface FavoriteFolder {
  id: string
  name: string
}

/** @deprecated Use FavoriteFolder */
export type Account = FavoriteFolder

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
  favoriteFolders: FavoriteFolder[]
  trades: TradeRecord[]
  potentialTrades: PotentialTrade[]
  locale?: 'ru' | 'en'
  wishlist?: string[]
  /** Remaining in-game trade initiations (manual tracker, daily cap 3). */
  tradeAttemptsLeft?: number
}

export const DEFAULT_FAVORITE_FOLDERS: FavoriteFolder[] = []
export const SOLO_FOLDER_ID = 'solo'

/** @deprecated Use DEFAULT_FAVORITE_FOLDERS */
export const DEFAULT_ACCOUNTS = DEFAULT_FAVORITE_FOLDERS
/** @deprecated Use SOLO_FOLDER_ID */
export const SOLO_ACCOUNT_ID = SOLO_FOLDER_ID

/** Daily trades that grant a bonus star. */
export const DAILY_BONUS_TRADE_LIMIT = 20

/** Daily trade initiations allowed in-game. */
export const DAILY_TRADE_INITIATION_LIMIT = 3

export const EMPTY_STATE: AppState = {
  owned: {},
  neededBy: {},
  favoriteFolders: DEFAULT_FAVORITE_FOLDERS,
  trades: [],
  potentialTrades: [],
  locale: 'ru',
  tradeAttemptsLeft: DAILY_TRADE_INITIATION_LIMIT,
}
