import { createContext, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import * as api from '../api/client'
import type { CardTradeEvent, PublicCollection } from '../api/client'
import { CollectionView } from '../components/CollectionView'
import { WishlistView } from '../components/WishlistView'
import { useI18n } from '../i18n'
import { BRAND_NAME } from '../brand'
import '../App.css'

const SharedCollectionContext = createContext<{ collection: PublicCollection; event: CardTradeEvent } | null>(null)

function useSharedCollection() {
  const value = useContext(SharedCollectionContext)
  if (!value) throw new Error('SharedCollectionContext missing')
  return value
}

export function SharedCollectionLayout() {
  const { eventSlug = 'summer-party', slug = '' } = useParams()
  const { t } = useI18n()
  const [payload, setPayload] = useState<{ collection: PublicCollection; event: CardTradeEvent } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void api
      .getEventPublicCollection(eventSlug, slug)
      .then((data) => {
        if (!cancelled) setPayload(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setPayload(null)
          setError(err instanceof Error ? err.message : 'Not found')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [eventSlug, slug])

  if (loading) {
    return <div className="app-loading">{t('auth.loading')}</div>
  }

  if (error || !payload) {
    return (
      <div className="app app--public">
        <div className="atmosphere" aria-hidden />
        <main className="main">
          <section className="panel">
            <p className="panel__error">{t('share.collectionNotFound')}</p>
            <div className="panel__actions">
              <Link to={`/card-trades/${eventSlug}/collections`} className="btn btn--ghost btn--sm">
                {t('share.allCollections')}
              </Link>
              <Link to="/card-trades" className="btn btn--primary btn--sm">
                {t('auth.login')}
              </Link>
            </div>
          </section>
        </main>
      </div>
    )
  }

  const { collection, event } = payload

  return (
    <SharedCollectionContext.Provider value={{ collection, event }}>
      <div className="app app--public">
        <div className="atmosphere" aria-hidden />

        <header className="hero hero--compact">
          <p className="hero__brand">{BRAND_NAME}</p>
          <h1 className="hero__title hero__title--name">{collection.username}</h1>
          <p className="hero__lead">{event.name}</p>
        </header>

        <nav className="tabs" aria-label={t('app.tabs')}>
          <NavLink
            to={`/card-trades/${eventSlug}/collections/${slug}`}
            end
            className={({ isActive }) => `tabs__btn ${isActive ? 'is-active' : ''}`}
          >
            {t('app.tab.collection')}
          </NavLink>
          <NavLink
            to={`/card-trades/${eventSlug}/collections/${slug}/needed`}
            className={({ isActive }) => `tabs__btn ${isActive ? 'is-active' : ''}`}
          >
            {t('app.tab.wishlist')}
          </NavLink>
        </nav>

        <main className="main">
          <Outlet />
        </main>

        <footer className="footer">
          {t('share.collectionFooter', {
            owned: collection.stats.uniqueOwned,
            total: event.cardCount,
          })}
        </footer>
      </div>
    </SharedCollectionContext.Provider>
  )
}

const emptyTradeNeed = new Set<string>()

export function SharedCollectionCollectionTab() {
  const { collection, event } = useSharedCollection()

  return (
    <CollectionView
      readOnly
      username={collection.username}
      cards={event.cards}
      sets={event.sets}
      owned={collection.owned}
      accounts={collection.accounts}
      neededBy={collection.neededBy}
      reservedByCard={{}}
      reservedPartners={{}}
      tradeNeedCardIds={emptyTradeNeed}
    />
  )
}

export function SharedCollectionNeededTab() {
  const { collection, event } = useSharedCollection()

  return (
    <WishlistView
      readOnly
      accounts={collection.accounts}
      cards={event.cards}
      neededBy={collection.neededBy}
      owned={collection.owned}
      tradeNeedCardIds={emptyTradeNeed}
    />
  )
}
