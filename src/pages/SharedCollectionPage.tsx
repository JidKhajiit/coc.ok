import { createContext, useContext, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import * as api from '../api/client'
import type { CardTradeEvent, PublicCollection } from '../api/client'
import { CardDetailModal } from '../components/CardDetailModal'
import { CollectionView } from '../components/CollectionView'
import { ReputationBadge } from '../components/ReputationBadge'
import { WishlistView } from '../components/WishlistView'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../i18n'
import { BRAND_NAME } from '../brand'
import {
  collectionNeededPath,
  collectionPath,
  collectionsListPath,
  eventPath,
  eventTabPath,
} from '../lib/events'
import { computeCollectionStats } from '../../shared/collectionStats'
import { EMPTY_REPUTATION } from '../../shared/reputation'
import { isCardTradeEventWritable } from '../../shared/eventAccess'
import { DAILY_BONUS_TRADE_LIMIT, DAILY_TRADE_INITIATION_LIMIT, type Card } from '../types'
import '../App.css'

const SharedCollectionContext = createContext<{
  collection: PublicCollection
  event: CardTradeEvent
  eventWritable: boolean
} | null>(null)

function useSharedCollection() {
  const value = useContext(SharedCollectionContext)
  if (!value) throw new Error('SharedCollectionContext missing')
  return value
}

export function SharedCollectionLayout() {
  const { eventSlug = 'summer-party', slug = '' } = useParams()
  const location = useLocation()
  const { t } = useI18n()
  const auth = useAuth()
  const [payload, setPayload] = useState<{ collection: PublicCollection; event: CardTradeEvent } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ownShareSlug, setOwnShareSlug] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!auth.user) {
      setOwnShareSlug(null)
      return
    }
    let cancelled = false
    setOwnShareSlug(undefined)
    void api
      .getEventShareSettings(eventSlug)
      .then((share) => {
        if (!cancelled) setOwnShareSlug(share.enabled && share.slug ? share.slug : null)
      })
      .catch(() => {
        if (!cancelled) setOwnShareSlug(null)
      })
    return () => {
      cancelled = true
    }
  }, [auth.user, eventSlug])

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

  // Opening your own public share → editable "my collection" / wishlist.
  if (ownShareSlug !== undefined && ownShareSlug && ownShareSlug === slug) {
    const to = location.pathname.endsWith('/needed')
      ? eventTabPath(eventSlug, 'wishlist')
      : eventPath(eventSlug)
    return <Navigate to={to} replace />
  }

  if (loading || (auth.user && ownShareSlug === undefined)) {
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
              <Link to={collectionsListPath(eventSlug)} className="btn btn--ghost btn--sm">
                {t('share.allCollections')}
              </Link>
              <Link to="/login" className="btn btn--primary btn--sm">
                {t('auth.login')}
              </Link>
            </div>
          </section>
        </main>
      </div>
    )
  }

  const { collection, event } = payload
  const eventWritable = isCardTradeEventWritable(event)
  const stats = computeCollectionStats(
    collection.owned,
    collection.neededBy,
    {},
    collection.tradeOffers ?? {},
  )
  const collectionPercent =
    event.cardCount > 0 ? Math.round((stats.uniqueOwned / event.cardCount) * 100) : 0

  return (
    <SharedCollectionContext.Provider value={{ collection, event, eventWritable }}>
      <div className="app app--public">
        <div className="atmosphere" aria-hidden />

        <header className="hero hero--compact">
          <p className="hero__brand">{BRAND_NAME}</p>
          <div className="hero__name-row">
            <h1 className="hero__title hero__title--name">{collection.username}</h1>
            <ReputationBadge reputation={collection.reputation ?? EMPTY_REPUTATION} />
          </div>
          <p className="hero__lead">{event.name}</p>
          {!eventWritable && (
            <p className="hero__lead panel__status" role="status">
              {t('app.eventReadOnly')}
            </p>
          )}
          <div className="hero__stats">
            <div
              className="stat"
              aria-label={t('app.stat.collectionAria', {
                percent: collectionPercent,
                owned: stats.uniqueOwned,
                total: event.cardCount,
              })}
            >
              <strong>{collectionPercent}%</strong>
              <span>
                {t('app.stat.collectionDetail', {
                  owned: stats.uniqueOwned,
                  total: event.cardCount,
                })}
              </span>
            </div>
            <div className="stat">
              <strong>{stats.tradeable}</strong>
              <span>{t('app.stat.forTrade')}</span>
            </div>
            <div className="stat">
              <strong>{stats.neededCount}</strong>
              <span>{t('app.stat.needed')}</span>
            </div>
            <div className="stat">
              <strong>
                {t('app.stat.tradesGoal', {
                  n: collection.stats.tradesToday,
                  limit: DAILY_BONUS_TRADE_LIMIT,
                })}
              </strong>
              <span>{t('app.stat.tradesToday')}</span>
            </div>
            <div className="stat">
              <strong>
                {t('app.stat.attemptsValue', {
                  n: collection.stats.tradeAttemptsLeft,
                  limit: DAILY_TRADE_INITIATION_LIMIT,
                })}
              </strong>
              <span>{t('app.stat.attemptsLeft')}</span>
            </div>
          </div>
        </header>

        <nav className="tabs" aria-label={t('app.tabs')}>
          <NavLink
            to={collectionPath(eventSlug, slug)}
            end
            className={({ isActive }) => `tabs__btn ${isActive ? 'is-active' : ''}`}
          >
            {t('app.tab.collection')}
          </NavLink>
          {eventWritable && (
            <NavLink
              to={collectionNeededPath(eventSlug, slug)}
              className={({ isActive }) => `tabs__btn ${isActive ? 'is-active' : ''}`}
            >
              {t('app.tab.wishlist')}
            </NavLink>
          )}
        </nav>

        <main className="main">
          <Outlet />
        </main>

        <footer className="footer">
          {t('share.collectionFooter', {
            owned: stats.uniqueOwned,
            total: event.cardCount,
          })}
        </footer>
      </div>
    </SharedCollectionContext.Provider>
  )
}

const emptyTradeNeed = new Set<string>()

export function SharedCollectionCollectionTab() {
  const { eventSlug = 'summer-party', slug = '' } = useParams()
  const { collection, event, eventWritable } = useSharedCollection()
  const auth = useAuth()
  const [detailCard, setDetailCard] = useState<Card | null>(null)
  const [myOwned, setMyOwned] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!auth.user) {
      setMyOwned({})
      return
    }
    let cancelled = false
    void api
      .getEventState(eventSlug)
      .then((payload) => {
        if (!cancelled) setMyOwned(payload.data.owned)
      })
      .catch(() => {
        if (!cancelled) setMyOwned({})
      })
    return () => {
      cancelled = true
    }
  }, [auth.user, eventSlug])

  const offerCards = event.cards.filter((c) => (myOwned[c.id] ?? 0) > 0)

  return (
    <>
      <CollectionView
        readOnly
        hideQty
        cards={event.cards}
        sets={event.sets}
        owned={collection.owned}
        favoriteFolders={collection.favoriteFolders}
        neededBy={collection.neededBy}
        reservedByCard={{}}
        reservedPartners={{}}
        tradeNeedCardIds={emptyTradeNeed}
        tradeOffers={collection.tradeOffers}
        onCardClick={setDetailCard}
      />
      {detailCard && (
        <CardDetailModal
          open
          onClose={() => setDetailCard(null)}
          card={detailCard}
          eventSlug={eventSlug}
          mode="public"
          qty={collection.owned[detailCard.id] ?? 0}
          hideQty
          neededAccountIds={collection.neededBy[detailCard.id] ?? []}
          tradeOffer={collection.tradeOffers?.[detailCard.id] ?? null}
          counterpartyShareSlug={slug || collection.slug}
          acceptTradeOffers={collection.acceptTradeOffers}
          signedIn={Boolean(auth.user)}
          offerCards={offerCards}
          ownedForPicker={myOwned}
          eventWritable={eventWritable}
        />
      )}
    </>
  )
}

export function SharedCollectionNeededTab() {
  const { eventSlug = 'summer-party', slug = '' } = useParams()
  const { collection, event, eventWritable } = useSharedCollection()
  const auth = useAuth()
  const [detailCard, setDetailCard] = useState<Card | null>(null)
  const [myOwned, setMyOwned] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!auth.user) {
      setMyOwned({})
      return
    }
    let cancelled = false
    void api
      .getEventState(eventSlug)
      .then((payload) => {
        if (!cancelled) setMyOwned(payload.data.owned)
      })
      .catch(() => {
        if (!cancelled) setMyOwned({})
      })
    return () => {
      cancelled = true
    }
  }, [auth.user, eventSlug])

  if (!eventWritable) {
    return <Navigate to={collectionPath(eventSlug, slug)} replace />
  }

  const offerCards = event.cards.filter((c) => (myOwned[c.id] ?? 0) > 0)

  return (
    <>
      <WishlistView
        readOnly
        hideQty
        favoriteFolders={collection.favoriteFolders}
        cards={event.cards}
        neededBy={collection.neededBy}
        owned={collection.owned}
        tradeNeedCardIds={emptyTradeNeed}
        onCardClick={setDetailCard}
      />
      {detailCard && (
        <CardDetailModal
          open
          onClose={() => setDetailCard(null)}
          card={detailCard}
          eventSlug={eventSlug}
          mode="public"
          qty={collection.owned[detailCard.id] ?? 0}
          hideQty
          neededAccountIds={collection.neededBy[detailCard.id] ?? []}
          tradeOffer={collection.tradeOffers?.[detailCard.id] ?? null}
          counterpartyShareSlug={slug || collection.slug}
          acceptTradeOffers={collection.acceptTradeOffers}
          signedIn={Boolean(auth.user)}
          offerCards={offerCards}
          ownedForPicker={myOwned}
          eventWritable={eventWritable}
        />
      )}
    </>
  )
}
