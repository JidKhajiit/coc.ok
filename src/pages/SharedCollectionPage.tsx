import { createContext, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import * as api from '../api/client'
import type { PublicCollection } from '../api/client'
import { CollectionView } from '../components/CollectionView'
import { WishlistView } from '../components/WishlistView'
import { useI18n } from '../i18n'
import { CARDS } from '../data/cards'
import { BRAND_NAME } from '../brand'
import '../App.css'

const SharedCollectionContext = createContext<PublicCollection | null>(null)

function useSharedCollection() {
  const value = useContext(SharedCollectionContext)
  if (!value) throw new Error('SharedCollectionContext missing')
  return value
}

export function SharedCollectionLayout() {
  const { slug = '' } = useParams()
  const { t } = useI18n()
  const [collection, setCollection] = useState<PublicCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void api
      .getPublicCollection(slug)
      .then((data) => {
        if (!cancelled) setCollection(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setCollection(null)
          setError(err instanceof Error ? err.message : 'Not found')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return <div className="app-loading">{t('auth.loading')}</div>
  }

  if (error || !collection) {
    return (
      <div className="app app--public">
        <div className="atmosphere" aria-hidden />
        <main className="main">
          <section className="panel">
            <p className="panel__error">{t('share.collectionNotFound')}</p>
            <div className="panel__actions">
              <Link to="/card-trades/collections" className="btn btn--ghost btn--sm">
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

  return (
    <SharedCollectionContext.Provider value={collection}>
      <div className="app app--public">
        <div className="atmosphere" aria-hidden />

        <header className="hero hero--compact">
          <p className="hero__brand">{BRAND_NAME}</p>
          <h1 className="hero__title hero__title--name">{collection.username}</h1>
          <p className="hero__lead">{t('share.publicCollectionLead')}</p>
        </header>

        <nav className="tabs" aria-label={t('app.tabs')}>
          <NavLink
            to={`/card-trades/collections/${slug}`}
            end
            className={({ isActive }) => `tabs__btn ${isActive ? 'is-active' : ''}`}
          >
            {t('app.tab.collection')}
          </NavLink>
          <NavLink
            to={`/card-trades/collections/${slug}/needed`}
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
            total: CARDS.length,
          })}
        </footer>
      </div>
    </SharedCollectionContext.Provider>
  )
}

const emptyTradeNeed = new Set<string>()

export function SharedCollectionCollectionTab() {
  const collection = useSharedCollection()

  return (
    <CollectionView
      readOnly
      username={collection.username}
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
  const collection = useSharedCollection()

  return (
    <WishlistView
      readOnly
      accounts={collection.accounts}
      neededBy={collection.neededBy}
      owned={collection.owned}
      tradeNeedCardIds={emptyTradeNeed}
    />
  )
}
