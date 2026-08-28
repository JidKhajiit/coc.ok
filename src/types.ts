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

export interface Account {
  id: string
  name: string
}

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
  /** cardId → id аккаунтов, которым нужна карта */
  neededBy: Record<string, string[]>
  accounts: Account[]
  trades: TradeRecord[]
  potentialTrades: PotentialTrade[]
  /** UI language */
  locale?: 'ru' | 'en'
  /** @deprecated миграция со старого формата */
  wishlist?: string[]
}

export type TabId = 'collection' | 'wishlist' | 'trades' | 'trends'

export interface TrendItem {
  cardId: string
  count: number
}

export const DEFAULT_ACCOUNTS: Account[] = []

/** Id для режима без списка аккаунтов (одна звезда) */
export const SOLO_ACCOUNT_ID = 'solo'
