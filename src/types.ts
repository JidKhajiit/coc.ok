export type Rarity = 1 | 2 | 3 | 4 | 5
export type CardColor = 'blue' | 'gold'

export interface Card {
  id: string
  name: string
  number: number
  rarity: Rarity
  color: CardColor
  setId: string
  setName: string
  /** Название пока неизвестно */
  unknownName?: boolean
}

export interface FavoriteFolder {
  id: string
  name: string
}

/** @deprecated Use FavoriteFolder */
export type Account = FavoriteFolder

/** Источник записи в истории обменов */
export type TradeSource = 'completed' | 'observed' | 'cancelled'

export interface TradeRecord {
  id: string
  givenCardId: string
  receivedCardId?: string
  partner?: string
  note?: string
  createdAt: string
  /**
   * completed — ваш обмен (меняет коллекцию);
   * observed — чужой/замеченный (архив);
   * cancelled — потенциал не состоялся (архив).
   * Старые записи без поля = completed.
   */
  source?: TradeSource
}

/** Запланированный обмен (карта отдачи помечена reserved) */
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
  /** cardId → id папок избранного, которым нужна карта */
  neededBy: Record<string, string[]>
  favoriteFolders: FavoriteFolder[]
  trades: TradeRecord[]
  potentialTrades: PotentialTrade[]
  /** UI language */
  locale?: 'ru' | 'en'
  /** @deprecated миграция со старого формата */
  wishlist?: string[]
  /** Оставшиеся инициации обменов в игре (ручной счётчик, лимит 3) */
  tradeAttemptsLeft?: number
}

export type TabId = 'collection' | 'wishlist' | 'trades' | 'trends'

export interface TrendItem {
  cardId: string
  count: number
}

export const DEFAULT_FAVORITE_FOLDERS: FavoriteFolder[] = []

/** Id для режима без списка папок (одна звезда) */
export const SOLO_FOLDER_ID = 'solo'

/** @deprecated Use DEFAULT_FAVORITE_FOLDERS */
export const DEFAULT_ACCOUNTS = DEFAULT_FAVORITE_FOLDERS
/** @deprecated Use SOLO_FOLDER_ID */
export const SOLO_ACCOUNT_ID = SOLO_FOLDER_ID

/** Лимит обменов в день, дающих бонусную звезду */
export const DAILY_BONUS_TRADE_LIMIT = 20

/** Лимит инициаций обменов в день в игре */
export const DAILY_TRADE_INITIATION_LIMIT = 3
