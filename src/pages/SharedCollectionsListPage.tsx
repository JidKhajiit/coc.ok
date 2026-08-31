import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api/client'
import type { PublicCollectionSummary } from '../api/client'
import { I18nProvider, useI18n } from '../i18n'
import { CARDS } from '../data/cards'
import { BRAND_NAME } from '../brand'
import '../App.css'

function SharedCollectionsList() {
  const { t } = useI18n()
  const [collections, setCollections] = useState<PublicCollectionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void api
      .listPublicCollections()
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
  }, [])

  return (
    <div className="app app--public">
      <div className="atmosphere" aria-hidden />

      <header className="hero hero--compact">
        <p className="hero__brand">{BRAND_NAME}</p>
        <h1 className="hero__title">{t('share.collectionsTitle')}</h1>
        <p className="hero__lead">{t('share.collectionsLead')}</p>
        <p className="hero__links">
          <Link to="/card-trades" className="hero__link">
            {t('share.backToApp')}
          </Link>
        </p>
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
                <Link to={`/card-trades/collections/${item.slug}`} className="share-list__item">
                  <strong>{item.username}</strong>
                  <span>
                    {t('share.collectionStats', {
                      owned: item.stats.uniqueOwned,
                      total: CARDS.length,
                      needed: item.stats.neededCount,
                    })}
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

export function SharedCollectionsListPage() {
  return (
    <I18nProvider locale="ru" setLocale={() => {}}>
      <SharedCollectionsList />
    </I18nProvider>
  )
}
