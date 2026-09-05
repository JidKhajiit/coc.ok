import {
  SUMMER_PARTY_CARDS,
  SUMMER_PARTY_SETS,
  cardId,
  rarityLabel,
  type CardTradeSet,
} from '../../shared/cardTradeCatalog'
import type { Card } from '../types'

export type CardSet = CardTradeSet

export const SETS: CardSet[] = SUMMER_PARTY_SETS
export const CARDS: Card[] = SUMMER_PARTY_CARDS as Card[]

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c])) as Record<
  string,
  Card
>

export const CARD_BY_NUMBER = Object.fromEntries(CARDS.map((c) => [c.number, c])) as Record<
  number,
  Card
>

/**
 * Достаёт номер карты из любого старого/нового id.
 * Поддерживает: n52, t3-52-blue, 52
 */
export function numberFromCardId(id: string): number | null {
  const nFormat = /^n(\d+)$/i.exec(id)
  if (nFormat) return Number(nFormat[1])

  const legacy = /^t\d+-(\d+)-(?:blue|gold)$/i.exec(id)
  if (legacy) return Number(legacy[1])

  const plain = /^(\d+)$/.exec(id)
  if (plain) return Number(plain[1])

  return null
}

/** Переводит любой id на стабильный n{number} */
export function migrateCardId(id: string): string | null {
  const num = numberFromCardId(id)
  if (num == null || !CARD_BY_NUMBER[num]) return null
  return cardId(num)
}

export { cardId, rarityLabel }
