import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as api from '../api/client'
import type { PublicCollectionSummary } from '../api/client'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const clearFilter = () => {
    setSearchParams({})
  }

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
        {filter && (
          <div className="panel__actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilter}>
              {t('share.collectionsClearFilter')}
            </button>
            <Link to={collectionsListPath(eventSlug)} className="btn btn--ghost btn--sm">
              {t('share.allCollections')}
            </Link>
          </div>
        )}
      </header>

      <main className="main">
        <section className="panel">
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
