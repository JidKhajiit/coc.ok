import type { ReactNode } from 'react'
import type { Card } from '../types'
import { rarityLabel } from '../data/cards'
import { useI18n } from '../i18n'

interface Props {
  card: Card
  qty?: number
  tradeable?: number
  reserved?: number | boolean
  reservedFor?: string[]
  selected?: boolean
  dimmed?: boolean
  onClick?: () => void
  actions?: ReactNode
  compact?: boolean
  showSet?: boolean
  /** Количество в строке meta (для компактных карточек, напр. тренды) */
  qtyInline?: boolean
}

export function CardItem({
  card,
  qty,
  tradeable,
  reserved,
  reservedFor,
  selected,
  dimmed,
  onClick,
  actions,
  compact,
  showSet = false,
  qtyInline,
}: Props) {
  const { t } = useI18n()
  const reservedCount = typeof reserved === 'number' ? reserved : reserved ? 1 : 0
  const isReserved = reservedCount > 0
  const showQtyInline = qtyInline && qty !== undefined
  const showQtyFooter = qty !== undefined && !showQtyInline

  const className = [
    'card-item',
    card.color === 'gold' ? 'card-item--gold' : 'card-item--blue',
    card.unknownName ? 'card-item--unknown' : '',
    isReserved ? 'card-item--reserved' : '',
    selected ? 'is-selected' : '',
    dimmed ? 'is-dimmed' : '',
    onClick ? 'is-clickable' : '',
    compact ? 'card-item--compact' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={className} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="card-item__meta">
        <span className="card-item__num">#{card.number}</span>
        <span className="card-item__rarity" title={`${card.rarity}★`}>
          {rarityLabel(card.rarity)}
        </span>
        <span className={`card-item__badge card-item__badge--${card.color}`}>
          {card.color === 'gold' ? t('card.gold') : t('card.blue')}
        </span>
        {showQtyInline && (
          <span className="card-item__qty-inline">×{qty}</span>
        )}
        {card.unknownName && (
          <span className="card-item__badge card-item__badge--unknown">?</span>
        )}
        {isReserved && (
          <span
            className="card-item__badge card-item__badge--reserved"
            title={
              reservedFor?.length
                ? t('card.reservedFor', { names: reservedFor.join(', ') })
                : undefined
            }
          >
            reserved{reservedCount > 1 ? `×${reservedCount}` : ''}
          </span>
        )}
      </div>
      <h3 className="card-item__name">
        {card.unknownName ? t('common.unnamed') : card.name}
      </h3>
      {showSet && !compact && <p className="card-item__set">{card.setName}</p>}
      {isReserved && reservedFor && reservedFor.length > 0 && !compact && (
        <p className="card-item__reserved-for">
          {t('card.for', { names: reservedFor.join(', ') })}
        </p>
      )}
      {(showQtyFooter || tradeable !== undefined || actions) && (
        <div className="card-item__footer">
          {showQtyFooter && (
            <span className="card-item__qty">
              ×{qty}
              {tradeable !== undefined && tradeable > 0 && (
                <em className="card-item__tradeable">
                  {t('card.tradeable', { n: tradeable })}
                </em>
              )}
            </span>
          )}
          {actions && (
            <div className="card-item__actions" onClick={(e) => e.stopPropagation()}>
              {actions}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
