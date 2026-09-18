import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import * as api from '../api/client'
import type { CardStats } from '../api/client'
import { rarityLabel } from '../data/cards'
import { useI18n, type MessageKey } from '../i18n'
import { collectionsListPath } from '../lib/events'
import type { Card, CardTradeOffer, ExtraDisposition, TradeWant } from '../types'
import {
  effectiveDisposition,
  effectiveWant,
  formatSpecificCardNumbers,
  parseSpecificCardNumbers,
} from '../../shared/tradeOffers'
import { CardPicker } from './CardPicker'

export type CardDetailMode = 'own-collection' | 'own-wishlist' | 'public'

const DISPOSITIONS: ExtraDisposition[] = ['keep', 'trade', 'surcharge', 'gift']
const WANTS: TradeWant[] = ['any', 'equal_or_more', 'specific']

type Props = {
  open: boolean
  onClose: () => void
  card: Card
  eventSlug: string
  mode: CardDetailMode
  qty: number
  neededAccountIds?: string[]
  /** Catalog for parsing specific card numbers. */
  catalogCards?: Card[]
  tradeOffer?: CardTradeOffer | null
  onChangeTradeOffer?: (offer: CardTradeOffer | null) => void
  /** Public share slug of the collection owner (for proposals). */
  counterpartyShareSlug?: string
  acceptTradeOffers?: boolean
  signedIn?: boolean
  /** Cards the viewer can offer (owned with qty > 0). */
  offerCards?: Card[]
  ownedForPicker?: Record<string, number>
}

export function CardDetailModal({
  open,
  onClose,
  card,
  eventSlug,
  mode,
  qty,
  neededAccountIds = [],
  catalogCards = [],
  tradeOffer = null,
  onChangeTradeOffer,
  counterpartyShareSlug,
  acceptTradeOffers = true,
  signedIn = false,
  offerCards = [],
  ownedForPicker = {},
}: Props) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [stats, setStats] = useState<CardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [proposing, setProposing] = useState(false)
  const [offerCardId, setOfferCardId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [specificText, setSpecificText] = useState('')
  const [specificInvalid, setSpecificInvalid] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setFeedback('')
    setProposing(false)
    setOfferCardId('')
    setStats(null)
    setSpecificText(formatSpecificCardNumbers(tradeOffer?.specificCardIds ?? [], catalogCards))
    setSpecificInvalid([])
    let cancelled = false
    setStatsLoading(true)
    void api
      .getEventCardStats(eventSlug, card.id)
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch(() => {
        if (!cancelled) setStats(null)
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // catalogCards / tradeOffer intentionally omitted — reset only on open/card change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventSlug, card.id])

  const pickerCards = useMemo(() => {
    return offerCards.filter((c) => (ownedForPicker[c.id] ?? 0) > 0 && c.id !== card.id)
  }, [offerCards, ownedForPicker, card.id])

  if (!open) return null

  const isOwn = mode === 'own-collection' || mode === 'own-wishlist'
  const isNeeded = neededAccountIds.length > 0
  const showExtrasEditor = mode === 'own-collection' && qty > 1 && onChangeTradeOffer
  const disposition = effectiveDisposition(tradeOffer)
  const want = effectiveWant(tradeOffer)
  const showWant = disposition === 'trade' || disposition === 'surcharge'
  const publicDisposition =
    mode === 'public' && qty > 1 && tradeOffer?.disposition
      ? tradeOffer.disposition
      : null

  const commitOffer = (next: CardTradeOffer) => {
    onChangeTradeOffer?.(next)
  }

  const setDisposition = (next: ExtraDisposition) => {
    if (next === 'keep' || next === 'gift') {
      commitOffer({ disposition: next })
      setSpecificText('')
      setSpecificInvalid([])
      return
    }
    commitOffer({
      disposition: next,
      want: tradeOffer?.want ?? 'any',
      specificCardIds:
        (tradeOffer?.want ?? 'any') === 'specific' ? tradeOffer?.specificCardIds : undefined,
    })
  }

  const setWant = (next: TradeWant) => {
    if (next === 'specific') {
      commitOffer({
        disposition,
        want: 'specific',
        specificCardIds: tradeOffer?.specificCardIds,
      })
      return
    }
    commitOffer({ disposition, want: next })
    setSpecificText('')
    setSpecificInvalid([])
  }

  const commitSpecific = (raw: string) => {
    const { ids, invalidTokens } = parseSpecificCardNumbers(raw, catalogCards)
    setSpecificInvalid(invalidTokens)
    commitOffer({
      disposition,
      want: 'specific',
      specificCardIds: ids.length ? ids : undefined,
    })
    setSpecificText(formatSpecificCardNumbers(ids, catalogCards) || raw.trim())
  }

  const goTradeFilter = () => {
    const role = mode === 'own-wishlist' ? 'owned' : 'needed'
    navigate(`${collectionsListPath(eventSlug)}?card=${encodeURIComponent(card.id)}&mode=${role}`)
    onClose()
  }

  const sendTrade = async () => {
    if (!counterpartyShareSlug || !offerCardId) return
    setBusy(true)
    setFeedback('')
    try {
      await api.createEventProposal(eventSlug, {
        toShareSlug: counterpartyShareSlug,
        type: 'trade',
        offeredCardKey: offerCardId,
        requestedCardKey: card.id,
      })
      setFeedback(t('cardDetail.proposalSent'))
      setProposing(false)
      setOfferCardId('')
    } catch {
      setFeedback(t('cardDetail.proposalFail'))
    } finally {
      setBusy(false)
    }
  }

  const sendGift = async () => {
    if (!counterpartyShareSlug) return
    setBusy(true)
    setFeedback('')
    try {
      await api.createEventProposal(eventSlug, {
        toShareSlug: counterpartyShareSlug,
        type: 'gift',
        requestedCardKey: card.id,
      })
      setFeedback(t('cardDetail.proposalSent'))
    } catch {
      setFeedback(t('cardDetail.proposalFail'))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="card-detail-root" role="presentation">
      <button
        type="button"
        className="card-detail__backdrop"
        onClick={onClose}
        aria-label={t('cardDetail.close')}
      />
      <div
        className="card-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-detail-title"
      >
        <header className="card-detail__head">
          <h2 id="card-detail-title">{t('cardDetail.title')}</h2>
          <button
            type="button"
            className="card-detail__close"
            onClick={onClose}
            aria-label={t('cardDetail.close')}
          >
            ×
          </button>
        </header>

        <div className="card-detail__body">
          <div
            className={`card-detail__art card-detail__art--${card.color}`}
            aria-hidden
          >
            <span className="card-detail__art-num">#{card.number}</span>
            <span className="card-detail__art-rarity">{rarityLabel(card.rarity)}</span>
            <span className="card-detail__art-hint">{t('cardDetail.imagePlaceholder')}</span>
          </div>

          <div className="card-detail__meta">
            <p className="card-detail__eyebrow">
              {card.setName} · {card.color === 'gold' ? t('card.gold') : t('card.blue')}
            </p>
            <h3 className="card-detail__name">
              {card.unknownName ? t('common.unnamed') : card.name}
            </h3>
            <p className="card-detail__qty">{t('cardDetail.qty', { n: qty })}</p>
            {(mode === 'own-wishlist' || mode === 'public') && (
              <p className="card-detail__needed">
                {isNeeded ? t('cardDetail.needed') : t('cardDetail.notNeeded')}
              </p>
            )}
            {publicDisposition && (
              <p className="card-detail__offer-badge">
                {t(`cardDetail.disposition.${publicDisposition}` as MessageKey)}
              </p>
            )}
          </div>

          {showExtrasEditor && (
            <div className="card-detail__extras">
              <p className="card-detail__extras-label">{t('cardDetail.extrasLabel')}</p>
              <div className="chip-row" role="group" aria-label={t('cardDetail.extrasLabel')}>
                {DISPOSITIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`chip ${disposition === d ? 'is-active' : ''}`}
                    onClick={() => setDisposition(d)}
                  >
                    {t(`cardDetail.disposition.${d}` as MessageKey)}
                  </button>
                ))}
              </div>

              {showWant && (
                <>
                  <p className="card-detail__extras-label">{t('cardDetail.wantLabel')}</p>
                  <div className="chip-row" role="group" aria-label={t('cardDetail.wantLabel')}>
                    {WANTS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        className={`chip ${want === w ? 'is-active' : ''}`}
                        onClick={() => setWant(w)}
                      >
                        {t(`cardDetail.want.${w}` as MessageKey)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {showWant && want === 'specific' && (
                <div className="card-detail__specific">
                  <input
                    type="text"
                    className="card-detail__specific-input"
                    value={specificText}
                    placeholder={t('cardDetail.specificPlaceholder')}
                    onChange={(e) => setSpecificText(e.target.value)}
                    onBlur={() => commitSpecific(specificText)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitSpecific(specificText)
                      }
                    }}
                  />
                  {specificInvalid.length > 0 && (
                    <p className="panel__error">
                      {t('cardDetail.specificInvalid', { tokens: specificInvalid.join(', ') })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card-detail__trends">
            {statsLoading && <p className="panel__status">{t('auth.loading')}</p>}
            {!statsLoading && !stats && (
              <p className="card-detail__trends-empty">{t('cardDetail.trendsNone')}</p>
            )}
            {!statsLoading && stats && (
              <span
                className="card-detail__tier"
                tabIndex={0}
                aria-describedby={`card-tier-tip-${card.id}`}
              >
                {t('cardDetail.tier', { tier: stats.tier })}
                <span id={`card-tier-tip-${card.id}`} className="card-detail__tier-tip" role="tooltip">
                  {t('cardDetail.trendsGiven', { n: stats.givenCount })}
                  {' · '}
                  {t('cardDetail.trendsRequested', { n: stats.requestedCount })}
                  {' · '}
                  {stats.rank != null
                    ? t('cardDetail.trendsRank', {
                        rank: stats.rank,
                        total: stats.totalCards,
                      })
                    : t('cardDetail.trendsNone')}
                </span>
              </span>
            )}
          </div>

          <div className="card-detail__actions">
            {isOwn && (
              <button type="button" className="btn btn--primary" onClick={goTradeFilter}>
                {t('cardDetail.trade')}
              </button>
            )}

            {mode === 'public' && !acceptTradeOffers && (
              <p className="card-detail__restricted">{t('share.offersRestricted')}</p>
            )}

            {mode === 'public' && acceptTradeOffers && !signedIn && (
              <p className="card-detail__restricted">{t('cardDetail.loginRequired')}</p>
            )}

            {mode === 'public' && acceptTradeOffers && signedIn && (
              <>
                {!proposing ? (
                  <div className="card-detail__action-row">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setProposing(true)}
                      disabled={busy || qty < 1}
                    >
                      {t('cardDetail.proposeTrade')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => void sendGift()}
                      disabled={busy || qty < 1}
                    >
                      {t('cardDetail.requestGift')}
                    </button>
                  </div>
                ) : (
                  <div className="card-detail__propose">
                    <p>{t('cardDetail.pickOffer')}</p>
                    <CardPicker
                      value={offerCardId}
                      onChange={setOfferCardId}
                      cards={pickerCards}
                      formatOption={(c) =>
                        `#${c.number} ${c.unknownName ? t('common.unnamed') : c.name} ×${ownedForPicker[c.id] ?? 0}`
                      }
                    />
                    <div className="card-detail__action-row">
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={!offerCardId || busy}
                        onClick={() => void sendTrade()}
                      >
                        {t('cardDetail.sendProposal')}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => setProposing(false)}
                      >
                        {t('cardDetail.close')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {feedback && <p className="settings-feedback">{feedback}</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
