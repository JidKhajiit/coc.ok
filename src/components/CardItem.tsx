import type { ReactNode } from 'react'
import type { Card } from '../types'
import { rarityLabel } from '../data/cards'
import { useI18n } from '../i18n'

export function TradeOfferIcon({ size = 14 }: { size?: number }) {
  return (
    <svg className="card-item__offer-icon" viewBox="0 0 16 16" width={size} height={size} aria-hidden>
      {/* Two opposing arrows — exchange */}
      <path
        fill="currentColor"
        d="M3 5.25h7.1l-.8.8a.75.75 0 1 0 1.06 1.06l2.12-2.12a.75.75 0 0 0 0-1.06L10.36 1.8A.75.75 0 1 0 9.3 2.87l.8.88H3a.75.75 0 0 0 0 1.5Zm10 5.5H5.9l.8-.8A.75.75 0 1 0 5.64 8.9L3.52 11a.75.75 0 0 0 0 1.06l2.12 2.12a.75.75 0 1 0 1.06-1.06l-.8-.87H13a.75.75 0 0 0 0-1.5Z"
      />
    </svg>
  )
}

export function GiftOfferIcon({ size = 14 }: { size?: number }) {
  return (
    <svg className="card-item__offer-icon" viewBox="0 0 16 16" width={size} height={size} aria-hidden>
      {/* Gift box with bow */}
      <path
        fill="currentColor"
        d="M8 1.4c1.05-1.05 2.75-1.05 3.8 0 1.05 1.05 1.05 2.75 0 3.8L10.6 6.4H12.5A1.5 1.5 0 0 1 14 7.9v.85H2V7.9A1.5 1.5 0 0 1 3.5 6.4h1.9L4.2 5.2c-1.05-1.05-1.05-2.75 0-3.8 1.05-1.05 2.75-1.05 3.8 0L8 1.4Zm-1.6 1.06a1.2 1.2 0 0 0 0 1.7L7.6 5.36 6.4 4.16a1.2 1.2 0 1 0-1.7-1.7Zm4.8 0a1.2 1.2 0 0 0-1.7 1.7l1.2 1.2 1.2-1.2a1.2 1.2 0 0 0-1.7-1.7ZM2.75 10.25H7.25V14H4A1.25 1.25 0 0 1 2.75 12.75v-2.5Zm5.5 3.75V10.25h4.5v2.5A1.25 1.25 0 0 1 12 14H8.25Z"
      />
    </svg>
  )
}

export function CardOfferCounts({
  tradeCount = 0,
  giftCount = 0,
  className,
}: {
  tradeCount?: number
  giftCount?: number
  className?: string
}) {
  const { t } = useI18n()
  // Gift wins when anyone is gifting; otherwise show trade if duplicates are offered.
  const showGift = giftCount > 0
  const showTrade = !showGift && tradeCount > 0
  if (!showTrade && !showGift) return null

  return (
    <div
      className={['card-item__offers', className].filter(Boolean).join(' ')}
      aria-label={t('card.offerCountsAria')}
    >
      {showGift ? (
        <span
          className="card-item__offer card-item__offer--gift"
          title={t('card.offerGift', { n: giftCount })}
          aria-label={t('card.offerGift', { n: giftCount })}
        >
          <GiftOfferIcon />
          <span className="card-item__offer-n">{giftCount}</span>
        </span>
      ) : (
        <span
          className="card-item__offer card-item__offer--trade"
          title={t('card.offerTrade', { n: tradeCount })}
          aria-label={t('card.offerTrade', { n: tradeCount })}
        >
          <TradeOfferIcon />
          <span className="card-item__offer-n">{tradeCount}</span>
        </span>
      )}
    </div>
  )
}

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
  /** Hide ×qty (public foreign collections). */
  hideQty?: boolean
  /** Live marketplace: how many players offer this card for trade. */
  offerTradeCount?: number
  /** Live marketplace: how many players gift this card. */
  offerGiftCount?: number
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
  hideQty = false,
  offerTradeCount,
  offerGiftCount,
}: Props) {
  const { t } = useI18n()
  const reservedCount = typeof reserved === 'number' ? reserved : reserved ? 1 : 0
  const isReserved = reservedCount > 0
  const showQtyInline = !hideQty && qtyInline && qty !== undefined
  const showQtyFooter = !hideQty && qty !== undefined && !showQtyInline
  const showPublicTrade = hideQty && tradeable !== undefined && tradeable > 0
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
      <CardOfferCounts
        tradeCount={offerTradeCount}
        giftCount={offerGiftCount}
        className="card-item__offers--corner"
      />
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
      {(showQtyFooter || showPublicTrade || actions) && (
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
          {showPublicTrade && (
            <span className="card-item__qty">
              <em className="card-item__tradeable">{t('card.forTrade')}</em>
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
