import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom'
import type { CardSet } from '../data/cards'
import { useAppState } from '../hooks/useAppState'
import { writeStoredLocale } from '../hooks/usePersistedLocale'
import { CollectionView } from '../components/CollectionView'
import { WishlistView } from '../components/WishlistView'
import { TradesView } from '../components/TradesView'
import { TrendsView } from '../components/TrendsView'
import { AppToolbar } from '../components/settings/AppToolbar'
import { CardTradesSettingsDrawer } from '../components/settings/CardTradesSettingsDrawer'
import { I18nProvider, localeTag, normalizeLocale, useI18n, type Locale, type MessageKey } from '../i18n'
import type { AuthOutletContext } from '../components/RequireAuth'
import { DAILY_BONUS_TRADE_LIMIT, type Card, type TabId } from '../types'
import type { CardTradeEvent } from '../api/client'
import * as api from '../api/client'
import '../App.css'

const SAVE_TOAST_MS = 3000

function tabRoutes(eventSlug: string): { id: TabId; path: string }[] {
  return [
    { id: 'collection', path: `/card-trades/${eventSlug}` },
    { id: 'wishlist', path: `/card-trades/${eventSlug}/wishlist` },
    { id: 'trades', path: `/card-trades/${eventSlug}/trades` },
    { id: 'trends', path: `/card-trades/${eventSlug}/trends` },
  ]
}

function CardTradesShell({
  app,
  event,
}: {
  app: ReturnType<typeof useAppState>
  event: CardTradeEvent
}) {
  const { user, logout } = useOutletContext<AuthOutletContext>()
  const [eventSettingsOpen, setEventSettingsOpen] = useState(false)
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const wasSavingRef = useRef(false)
  const { t, locale, setLocale } = useI18n()
  const routes = useMemo(() => tabRoutes(event.slug), [event.slug])

  useEffect(() => {
    writeStoredLocale(normalizeLocale(app.state.locale))
  }, [app.state.locale])

  const handleLocaleChange = (next: Locale) => {
    setLocale(next)
  }

  useEffect(() => {
    if (app.saving) {
      wasSavingRef.current = true
      setSaveToast(t('auth.saving'))
      return
    }

    if (app.saveError) {
      wasSavingRef.current = false
      setSaveToast(t('auth.saveError'))
      return
    }

    if (wasSavingRef.current && app.lastSaved) {
      wasSavingRef.current = false
      setSaveToast(t('auth.saved'))
      const timer = setTimeout(() => setSaveToast(null), SAVE_TOAST_MS)
      return () => clearTimeout(timer)
    }
  }, [app.saving, app.saveError, app.lastSaved, t])

  const tradesToday = app.stats.tradesToday
  const totalCards = event.cards.length
  const collectionPercent = totalCards > 0 ? Math.round((app.stats.uniqueOwned / totalCards) * 100) : 0
  const tradesGoalClass =
    tradesToday >= DAILY_BONUS_TRADE_LIMIT
      ? tradesToday > DAILY_BONUS_TRADE_LIMIT
        ? 'stat--over'
        : 'stat--ok'
      : ''

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden />

      <AppToolbar
        username={user.username}
        permissions={user.permissions}
        onLogout={logout}
        locale={locale}
        onLocaleChange={handleLocaleChange}
        onEventSettings={() => setEventSettingsOpen(true)}
        showCollectionNav
        collectionPath={`/card-trades/${event.slug}/collections`}
      />

      {saveToast && (
        <div className="save-toast" role="status" aria-live="polite">
          {saveToast}
        </div>
      )}

      <CardTradesSettingsDrawer
        open={eventSettingsOpen}
        username={user.username}
        onClose={() => setEventSettingsOpen(false)}
        accounts={app.state.accounts}
        onAdd={() => app.addAccount()}
        onRemove={app.removeAccount}
        onRename={app.renameAccount}
        onExport={app.exportBackup}
        onCopyBackup={app.copyBackup}
        onImport={app.importBackup}
        onImportText={app.importBackupText}
        eventSlug={event.slug}
      />

      {app.loading ? (
        <div className="app-loading">{t('auth.loading')}</div>
      ) : (
        <>
          <header className="hero">
            <Link to="/card-trades" className="hero__home-link">← {t('app.backToTracker')}</Link>
            <h1 className="hero__title">{event.name}</h1>

            <div className="hero__stats">
              <div
                className="stat"
                aria-label={t('app.stat.collectionAria', {
                  percent: collectionPercent,
                  owned: app.stats.uniqueOwned,
                  total: totalCards,
                })}
              >
                <strong>{collectionPercent}%</strong>
                <span>
                  {t('app.stat.collectionDetail', {
                    owned: app.stats.uniqueOwned,
                    total: totalCards,
                  })}
                </span>
              </div>
              <div className="stat">
                <strong>{app.stats.tradeable}</strong>
                <span>{t('app.stat.forTrade')}</span>
              </div>
              <div className="stat">
                <strong>{app.stats.wishlistCount}</strong>
                <span>{t('app.stat.needed')}</span>
              </div>
              <div className={`stat ${tradesGoalClass}`}>
                <span className="stat__help help-tip help-tip--hero">
                  <button
                    type="button"
                    className="help-tip__btn"
                    aria-label={t('app.stat.tradesTodayHelpAria')}
                  >
                    ?
                  </button>
                  <span className="help-tip__popup" role="tooltip">
                    {t('app.stat.tradesTodayHelp', { limit: DAILY_BONUS_TRADE_LIMIT })}
                  </span>
                </span>
                <strong>
                  {t('app.stat.tradesGoal', {
                    n: tradesToday,
                    limit: DAILY_BONUS_TRADE_LIMIT,
                  })}
                </strong>
                <span>{t('app.stat.tradesToday')}</span>
              </div>
            </div>

          </header>

          <nav className="tabs" aria-label={t('app.tabs')}>
            {routes.map(({ id, path }) => (
              <NavLink
                key={id}
                to={path}
                end={id === 'collection'}
                className={({ isActive }) => `tabs__btn ${isActive ? 'is-active' : ''}`}
              >
                {t(`app.tab.${id}` as MessageKey)}
              </NavLink>
            ))}
          </nav>

          <main className="main">
            <Outlet context={{ app, user, event }} />
          </main>

          <footer className="footer">{t('app.footer', { cards: totalCards })}</footer>
        </>
      )}
    </div>
  )
}

export type CardTradesOutletContext = {
  app: ReturnType<typeof useAppState>
  user: { id: string; username: string; permissions: string[] }
  event: { slug: string; name: string; cards: Card[]; sets: CardSet[] }
}

export function CardTradesCollectionTab() {
  const { app, user, event } = useOutletContext<CardTradesOutletContext>()

  return (
    <CollectionView
      username={user.username}
      cards={event.cards}
      sets={event.sets}
      owned={app.state.owned}
      accounts={app.state.accounts}
      neededBy={app.state.neededBy}
      reservedByCard={app.reservedByCard}
      reservedPartners={app.reservedPartners}
      tradeNeedCardIds={app.tradeNeedCardIds}
      onAdjust={app.adjustOwned}
      onToggleNeeded={app.toggleNeeded}
      onSetNeededForAll={app.setNeededForAll}
      onToggleStar={app.toggleStar}
    />
  )
}

export function CardTradesWishlistTab() {
  const { app, event } = useOutletContext<CardTradesOutletContext>()

  return (
    <WishlistView
      accounts={app.state.accounts}
      cards={event.cards}
      neededBy={app.state.neededBy}
      owned={app.state.owned}
      tradeNeedCardIds={app.tradeNeedCardIds}
      onToggleNeeded={app.toggleNeeded}
      onSetNeededForAll={app.setNeededForAll}
      onToggleStar={app.toggleStar}
    />
  )
}

export function CardTradesTradesTab() {
  const { app, event } = useOutletContext<CardTradesOutletContext>()

  return (
    <TradesView
      cards={event.cards}
      owned={app.state.owned}
      trades={app.state.trades}
      potentialTrades={app.state.potentialTrades}
      reservedByCard={app.reservedByCard}
      onAdd={app.addTrade}
      onRemove={app.removeTrade}
      onAddPotential={app.addPotentialTrade}
      onUpdatePotential={app.updatePotentialTrade}
      onRemovePotential={app.removePotentialTrade}
      onConfirmPotential={app.confirmPotentialTrade}
      onArchivePotential={app.archivePotentialTrade}
    />
  )
}

export function CardTradesTrendsTab() {
  const { app } = useOutletContext<CardTradesOutletContext>()

  return (
    <TrendsView
      owned={app.state.owned}
      mostGiven={app.trends.mostGiven}
      mostRequested={app.trends.mostRequested}
      tradeCount={app.stats.historyCount}
    />
  )
}

export function CardTradesPage() {
  const { eventSlug = '' } = useParams()
  const [event, setEvent] = useState<CardTradeEvent | null>(null)
  const [eventError, setEventError] = useState<string | null>(null)
  const [eventLoading, setEventLoading] = useState(true)
  const app = useAppState(eventSlug, event?.cards ?? [])
  const locale = normalizeLocale(app.state.locale)

  const setLocale = useCallback(
    (next: Locale) => {
      writeStoredLocale(next)
      app.setLocale(next)
    },
    [app.setLocale],
  )

  useEffect(() => {
    document.documentElement.lang = localeTag(locale)
  }, [locale])

  useEffect(() => {
    let cancelled = false
    setEventLoading(true)
    setEventError(null)
    void api
      .getCardTradeEvent(eventSlug)
      .then((data) => {
        if (!cancelled) setEvent(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setEvent(null)
          setEventError(err instanceof Error ? err.message : 'Event not found')
        }
      })
      .finally(() => {
        if (!cancelled) setEventLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [eventSlug])

  return (
    <I18nProvider locale={locale} setLocale={setLocale}>
      {eventLoading ? (
        <div className="app-loading">Loading…</div>
      ) : eventError || !event ? (
        <div className="app">
          <div className="atmosphere" aria-hidden />
          <main className="main">
            <section className="panel">
              <p className="panel__error">{eventError ?? 'Event not found'}</p>
              <div className="panel__actions">
                <Link to="/card-trades" className="btn btn--primary btn--sm">
                  Back to tracker
                </Link>
              </div>
            </section>
          </main>
        </div>
      ) : (
        <CardTradesShell app={app} event={event} />
      )}
    </I18nProvider>
  )
}
