import { useEffect, useState } from 'react'
import { CARDS } from './data/cards'
import { useAppState } from './hooks/useAppState'
import { CollectionView } from './components/CollectionView'
import { WishlistView } from './components/WishlistView'
import { TradesView } from './components/TradesView'
import { TrendsView } from './components/TrendsView'
import { SettingsModal } from './components/SettingsModal'
import { I18nProvider, localeTag, normalizeLocale, useI18n, type MessageKey } from './i18n'
import type { TabId } from './types'
import './App.css'

const TAB_IDS: TabId[] = ['collection', 'wishlist', 'trades', 'trends']

type AppApi = ReturnType<typeof useAppState>

function AppShell({ app }: { app: AppApi }) {
  const [tab, setTab] = useState<TabId>('collection')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { t, locale } = useI18n()

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden />

      <button
        type="button"
        className="settings-gear"
        onClick={() => setSettingsOpen(true)}
        aria-label={t('app.settings')}
        title={t('app.settings')}
      >
        ⚙
      </button>

      <SettingsModal
        open={settingsOpen}
        accounts={app.state.accounts}
        locale={locale}
        onLocaleChange={app.setLocale}
        onClose={() => setSettingsOpen(false)}
        onAdd={() => app.addAccount()}
        onRemove={app.removeAccount}
        onRename={app.renameAccount}
        onExport={app.exportBackup}
        onCopyBackup={app.copyBackup}
        onImport={app.importBackup}
        onImportText={app.importBackupText}
      />

      <header className="hero">
        <p className="hero__brand">Critter Trades</p>
        <h1 className="hero__title">{t('app.heroTitle')}</h1>
        <p className="hero__lead">{t('app.heroLead')}</p>

        <div className="hero__stats">
          <div className="stat">
            <strong>{app.stats.uniqueOwned}</strong>
            <span>{t('app.stat.ofCards', { n: CARDS.length })}</span>
          </div>
          <div className="stat">
            <strong>{app.stats.tradeable}</strong>
            <span>{t('app.stat.forTrade')}</span>
          </div>
          <div className="stat">
            <strong>{app.stats.wishlistCount}</strong>
            <span>{t('app.stat.needed')}</span>
          </div>
          <div className={`stat ${app.stats.tradesToday > 0 ? 'stat--ok' : ''}`}>
            <strong>{app.stats.tradesToday}</strong>
            <span>{t('app.stat.tradesToday')}</span>
          </div>
        </div>
      </header>

      <nav className="tabs" aria-label={t('app.tabs')}>
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`tabs__btn ${tab === id ? 'is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {t(`app.tab.${id}` as MessageKey)}
          </button>
        ))}
      </nav>

      <main className="main">
        {tab === 'collection' && (
          <CollectionView
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
        )}
        {tab === 'wishlist' && (
          <WishlistView
            accounts={app.state.accounts}
            neededBy={app.state.neededBy}
            owned={app.state.owned}
            tradeNeedCardIds={app.tradeNeedCardIds}
            onToggleNeeded={app.toggleNeeded}
            onSetNeededForAll={app.setNeededForAll}
            onToggleStar={app.toggleStar}
          />
        )}
        {tab === 'trades' && (
          <TradesView
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
        )}
        {tab === 'trends' && (
          <TrendsView
            owned={app.state.owned}
            mostGiven={app.trends.mostGiven}
            mostRequested={app.trends.mostRequested}
            tradeCount={app.stats.historyCount}
          />
        )}
      </main>

      <footer className="footer">{t('app.footer', { cards: CARDS.length })}</footer>
    </div>
  )
}

export default function App() {
  const app = useAppState()
  const locale = normalizeLocale(app.state.locale)

  useEffect(() => {
    document.documentElement.lang = localeTag(locale)
  }, [locale])

  return (
    <I18nProvider locale={locale} setLocale={app.setLocale}>
      <AppShell app={app} />
    </I18nProvider>
  )
}
