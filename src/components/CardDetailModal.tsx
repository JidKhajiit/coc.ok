import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import * as api from '../api/client'
import type { CardStats } from '../api/client'
import { rarityLabel } from '../data/cards'
import { useI18n } from '../i18n'
import { collectionsListPath } from '../lib/events'
import type { Card } from '../types'
import { CardPicker } from './CardPicker'

export type CardDetailMode = 'own-collection' | 'own-wishlist' | 'public'

type Props = {
  open: boolean
  onClose: () => void
  card: Card
  eventSlug: string
  mode: CardDetailMode
  qty: number
  neededAccountIds?: string[]
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
  }, [open, eventSlug, card.id])

  const pickerCards = useMemo(() => {
    return offerCards.filter((c) => (ownedForPicker[c.id] ?? 0) > 0 && c.id !== card.id)
  }, [offerCards, ownedForPicker, card.id])

  if (!open) return null

  const isOwn = mode === 'own-collection' || mode === 'own-wishlist'
  const isNeeded = neededAccountIds.length > 0

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
          </div>

          <div className="card-detail__trends">
            {statsLoading && <p className="panel__status">{t('auth.loading')}</p>}
            {!statsLoading && !stats && (
              <p className="card-detail__trends-empty">{t('cardDetail.trendsNone')}</p>
            )}
            {!statsLoading && stats && (
              <>
                <p className="card-detail__tier">{t('cardDetail.tier', { tier: stats.tier })}</p>
                <ul className="card-detail__trend-list">
                  <li>{t('cardDetail.trendsGiven', { n: stats.givenCount })}</li>
                  <li>{t('cardDetail.trendsRequested', { n: stats.requestedCount })}</li>
                  {stats.rank != null ? (
                    <li>
                      {t('cardDetail.trendsRank', {
                        rank: stats.rank,
                        total: stats.totalCards,
                      })}
                    </li>
                  ) : (
                    <li>{t('cardDetail.trendsNone')}</li>
                  )}
                </ul>
              </>
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
