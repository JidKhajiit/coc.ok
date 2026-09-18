import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as api from '../api/client'
import type { CardTradeEvent, PublicCollectionSummary } from '../api/client'
import { PublicAppShell } from '../components/PublicAppShell'
import { useI18n } from '../i18n'
import { BRAND_NAME } from '../brand'
import { collectionPath, collectionsListPath } from '../lib/events'
import '../App.css'

function SharedCollectionsList({ eventSlug }: { eventSlug: string }) {
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const cardId = searchParams.get('card')
  const mode = searchParams.get('mode')
  const filter =
    cardId && (mode === 'needed' || mode === 'owned')
      ? { cardId, role: mode as 'needed' | 'owned' }
      : undefined

  const [collections, setCollections] = useState<PublicCollectionSummary[]>([])
  const [event, setEvent] = useState<CardTradeEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const sortedCards = useMemo(
    () => (event?.cards ? [...event.cards].sort((a, b) => a.number - b.number) : []),
    [event],
  )

  useEffect(() => {
    let cancelled = false
    void api
      .getCardTradeEvent(eventSlug)
      .then((data) => {
        if (!cancelled) setEvent(data)
      })
      .catch(() => {
        if (!cancelled) setEvent(null)
      })
    return () => {
      cancelled = true
    }
  }, [eventSlug])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void api
      .listEventPublicCollections(eventSlug, filter)
      .then((data) => {
        if (!cancelled) setCollections(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [eventSlug, filter?.cardId, filter?.role])

  const setRole = (role: 'needed' | 'owned') => {
    const next = new URLSearchParams(searchParams)
    next.set('mode', role)
    if (!next.get('card') && sortedCards[0]) {
      next.set('card', sortedCards[0].id)
    }
    setSearchParams(next)
  }

  const setCard = (nextCardId: string) => {
    if (!nextCardId) {
      setSearchParams({})
      return
    }
    const next = new URLSearchParams(searchParams)
    next.set('card', nextCardId)
    if (next.get('mode') !== 'needed' && next.get('mode') !== 'owned') {
      next.set('mode', 'needed')
    }
    setSearchParams(next)
  }

  const clearFilter = () => {
    setSearchParams({})
  }

  const activeRole = mode === 'owned' ? 'owned' : mode === 'needed' ? 'needed' : null

  return (
    <div className="app app--public">
      <div className="atmosphere" aria-hidden />

      <header className="hero hero--compact">
        <p className="hero__brand">{BRAND_NAME}</p>
        <h1 className="hero__title">{t('share.collectionsTitle')}</h1>
        <p className="hero__lead">
          {filter?.role === 'needed'
            ? t('share.collectionsFilterNeeded')
            : filter?.role === 'owned'
              ? t('share.collectionsFilterOwned')
              : t('share.collectionsLead')}
        </p>
      </header>

      <main className="main">
        <section className="panel">
          <div className="share-filters">
            <div className="share-filters__group">
              <span className="share-filters__label">{t('share.filterRole')}</span>
              <div className="chip-row" role="group" aria-label={t('share.filterRole')}>
                <button
                  type="button"
                  className={`chip ${activeRole === 'needed' ? 'is-active' : ''}`}
                  onClick={() => setRole('needed')}
                >
                  {t('share.filterRoleNeeded')}
                </button>
                <button
                  type="button"
                  className={`chip ${activeRole === 'owned' ? 'is-active' : ''}`}
                  onClick={() => setRole('owned')}
                >
                  {t('share.filterRoleOwned')}
                </button>
              </div>
            </div>
            <div className="share-filters__group">
              <label className="share-filters__label" htmlFor="share-filter-card">
                {t('share.filterCard')}
              </label>
              <select
                id="share-filter-card"
                className="share-filters__select"
                value={cardId ?? ''}
                onChange={(e) => setCard(e.target.value)}
                disabled={sortedCards.length === 0}
              >
                <option value="">{t('share.filterCardPlaceholder')}</option>
                {sortedCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.number}
                    {c.unknownName ? '' : ` · ${c.name}`}
                  </option>
                ))}
              </select>
            </div>
            {filter && (
              <div className="panel__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilter}>
                  {t('share.collectionsClearFilter')}
                </button>
                <Link to={collectionsListPath(eventSlug)} className="btn btn--ghost btn--sm">
                  {t('share.allCollections')}
                </Link>
              </div>
            )}
          </div>

          {loading && <p className="panel__status">{t('auth.loading')}</p>}
          {error && <p className="panel__error">{error}</p>}
          {!loading && !error && collections.length === 0 && (
            <p className="panel__status">{t('share.collectionsEmpty')}</p>
          )}
          <ul className="share-list">
            {collections.map((item) => (
              <li key={item.slug}>
                <Link to={collectionPath(eventSlug, item.slug)} className="share-list__item">
                  <div className="share-list__identity">
                    <strong>{item.username}</strong>
                  </div>
                  <span>
                    {t('share.collectionStats', {
                      owned: item.stats.uniqueOwned,
                      total: item.event.cardCount,
                      needed: item.stats.neededCount,
                    })}
                    {' · '}
                    {t('share.collectionTradeable', { n: item.stats.tradeable })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}

export function SharedCollectionsListPage({ eventSlug }: { eventSlug: string }) {
  return (
    <PublicAppShell>
      <SharedCollectionsList eventSlug={eventSlug} />
    </PublicAppShell>
  )
}
