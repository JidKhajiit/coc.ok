import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as api from '../api/client'
import type {
  CardTradeEvent,
  CollectionFilterRole,
  PublicCollectionSummary,
} from '../api/client'
import { PublicAppShell } from '../components/PublicAppShell'
import { ReputationBadge } from '../components/ReputationBadge'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../i18n'
import { BRAND_NAME } from '../brand'
import { collectionPath, eventPath } from '../lib/events'
import {
  collectionMatchTier,
  viewerNeededCardIds,
  viewerTradeableCardIds,
} from '../../shared/collectionMatch'
import { EMPTY_REPUTATION } from '../../shared/reputation'
import { migrateState } from '../../shared/migrateState'
import '../App.css'

const ROLES: CollectionFilterRole[] = ['needed', 'trade', 'gift']

function SharedCollectionsList({ eventSlug }: { eventSlug: string }) {
  const { t } = useI18n()
  const auth = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const cardId = searchParams.get('card')
  const mode = searchParams.get('mode')
  const filterRole: CollectionFilterRole | null =
    mode === 'needed' || mode === 'trade' || mode === 'gift'
      ? mode
      : mode === 'owned'
        ? 'trade'
        : null
  const filter =
    cardId && filterRole ? { cardId, role: filterRole } : undefined

  const [collections, setCollections] = useState<PublicCollectionSummary[]>([])
  const [event, setEvent] = useState<CardTradeEvent | null>(null)
  const [myNeeded, setMyNeeded] = useState<Set<string> | null>(null)
  const [myTradeable, setMyTradeable] = useState<Set<string> | null>(null)
  const [ownShareSlug, setOwnShareSlug] = useState<string | null>(null)
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

  useEffect(() => {
    if (!auth.user) {
      setMyNeeded(null)
      setMyTradeable(null)
      setOwnShareSlug(null)
      return
    }
    let cancelled = false
    void api
      .getEventState(eventSlug)
      .then((payload) => {
        if (cancelled) return
        const state = migrateState(payload.data)
        setMyNeeded(viewerNeededCardIds(state))
        setMyTradeable(viewerTradeableCardIds(state))
      })
      .catch(() => {
        if (!cancelled) {
          setMyNeeded(null)
          setMyTradeable(null)
        }
      })
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

  const sortedCollections = useMemo(() => {
    const list = [...collections]
    const hasFilter = Boolean(filter)
    const canMatch = !hasFilter && myNeeded && myTradeable

    list.sort((a, b) => {
      if (canMatch) {
        const tierA = collectionMatchTier(
          a.offeredCardIds ?? [],
          a.neededCardIds ?? [],
          myNeeded,
          myTradeable,
        )
        const tierB = collectionMatchTier(
          b.offeredCardIds ?? [],
          b.neededCardIds ?? [],
          myNeeded,
          myTradeable,
        )
        if (tierA !== tierB) return tierA - tierB
      }

      const dealsA = a.reputation?.dealsCompleted ?? 0
      const dealsB = b.reputation?.dealsCompleted ?? 0
      if (dealsA !== dealsB) return dealsB - dealsA

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    return list
  }, [collections, filter, myNeeded, myTradeable])

  const setRole = (role: CollectionFilterRole) => {
    const next = new URLSearchParams(searchParams)
    if (filterRole === role) {
      next.delete('mode')
    } else {
      next.set('mode', role)
    }
    setSearchParams(next)
  }

  const setCard = (nextCardId: string) => {
    const next = new URLSearchParams(searchParams)
    if (!nextCardId) {
      next.delete('card')
    } else {
      next.set('card', nextCardId)
    }
    setSearchParams(next)
  }

  const clearFilter = () => {
    setSearchParams({})
  }

  const roleWithoutCard = Boolean(filterRole && !cardId)
  const cardWithoutRole = Boolean(cardId && !filterRole)
  const filterIncomplete = roleWithoutCard || cardWithoutRole

  const leadKey =
    filter?.role === 'needed'
      ? 'share.collectionsFilterNeeded'
      : filter?.role === 'trade'
        ? 'share.collectionsFilterTrade'
        : filter?.role === 'gift'
          ? 'share.collectionsFilterGift'
          : 'share.collectionsLead'

  return (
    <div className="app app--public">
      <div className="atmosphere" aria-hidden />

      <header className="hero hero--compact">
        <p className="hero__brand">{BRAND_NAME}</p>
        <h1 className="hero__title">{t('share.collectionsTitle')}</h1>
        <p className="hero__lead">{t(leadKey)}</p>
      </header>

      <main className="main">
        <section className="panel">
          <div className="share-filters">
            <div className="share-filters__group">
              <span className="share-filters__label">{t('share.filterRole')}</span>
              <div className="chip-row" role="group" aria-label={t('share.filterRole')}>
                {ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`chip ${filterRole === role ? 'is-active' : ''}`}
                    onClick={() => setRole(role)}
                  >
                    {t(
                      role === 'needed'
                        ? 'share.filterRoleNeeded'
                        : role === 'trade'
                          ? 'share.filterRoleTrade'
                          : 'share.filterRoleGift',
                    )}
                  </button>
                ))}
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
            {(filter || filterIncomplete) && (
              <div className="panel__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilter}>
                  {t('share.collectionsClearFilter')}
                </button>
              </div>
            )}
          </div>

          {filterIncomplete && (
            <p className="panel__status">{t('share.filterIncomplete')}</p>
          )}

          {loading && <p className="panel__status">{t('auth.loading')}</p>}
          {error && <p className="panel__error">{error}</p>}
          {!loading && !error && !filterIncomplete && sortedCollections.length === 0 && (
            <p className="panel__status">
              {t(filter ? 'share.collectionsFilterEmpty' : 'share.collectionsEmpty')}
            </p>
          )}
          {!filterIncomplete && (
            <ul className="share-list">
              {sortedCollections.map((item) => (
                <li key={item.slug}>
                  <Link
                    to={
                      ownShareSlug && item.slug === ownShareSlug
                        ? eventPath(eventSlug)
                        : collectionPath(eventSlug, item.slug)
                    }
                    className="share-list__item"
                  >
                    <div className="share-list__identity">
                      <strong>{item.username}</strong>
                      <ReputationBadge
                        reputation={item.reputation ?? EMPTY_REPUTATION}
                        className="share-list__reputation"
                      />
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
          )}
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
