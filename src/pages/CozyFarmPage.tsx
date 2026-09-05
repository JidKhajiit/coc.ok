import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { AppToolbar } from '../components/settings/AppToolbar'
import {
  CozyFarmOptimizer,
  type CozyFarmCropInject,
} from '../components/cozy-farm/CozyFarmOptimizer'
import type { AuthOutletContext } from '../components/RequireAuth'
import { I18nProvider, localeTag, useI18n, type MessageKey } from '../i18n'
import { usePersistedLocale } from '../hooks/usePersistedLocale'
import * as api from '../api/client'
import type { CozyFarmListing, CozyFarmListingInput } from '../api/client'
import { COZY_FARM_FRUITS, type CozyFarmFruit } from '../lib/cozyFarmOptimizer'
import frugantuanImg from '../assets/tatari/GLITTER_FRUGANTUAN.webp'
import haplysiaImg from '../assets/tatari/GLITTER_HAPLYSIA.webp'
import pandagrandImg from '../assets/tatari/GLITTER_PANDAGRAND.webp'
import dagondeepImg from '../assets/tatari/GLITTER_DAGONDEEP.webp'
import umbraveilImg from '../assets/tatari/GLITTER_UMBRAVEIL.webp'
import hypnostrixImg from '../assets/tatari/GLITTER_HYPNOSTRIX.webp'
import '../App.css'

const FRUIT_LABEL: Record<CozyFarmFruit, MessageKey> = {
  dragonfruit: 'cozyFarm.fruit.dragonfruit',
  carrot: 'cozyFarm.fruit.carrot',
  bamboo: 'cozyFarm.fruit.bamboo',
  phantom: 'cozyFarm.fruit.phantom',
  cranberry: 'cozyFarm.fruit.cranberry',
  orange: 'cozyFarm.fruit.orange',
}

const FRUIT_ICON: Record<CozyFarmFruit, string> = {
  dragonfruit: frugantuanImg,
  carrot: haplysiaImg,
  bamboo: pandagrandImg,
  phantom: dagondeepImg,
  cranberry: umbraveilImg,
  orange: hypnostrixImg,
}

type BonusField =
  | 'bonusDragonfruit'
  | 'bonusCarrot'
  | 'bonusBamboo'
  | 'bonusPhantom'
  | 'bonusCranberry'
  | 'bonusOrange'

const BONUS_FIELD: Record<CozyFarmFruit, BonusField> = {
  dragonfruit: 'bonusDragonfruit',
  carrot: 'bonusCarrot',
  bamboo: 'bonusBamboo',
  phantom: 'bonusPhantom',
  cranberry: 'bonusCranberry',
  orange: 'bonusOrange',
}

function parseBonus(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return null
  return n
}

function formatBonus(value: number | null): string {
  if (value == null) return '—'
  return `${value}%`
}

function listingBonus(listing: CozyFarmListing, fruit: CozyFarmFruit): number | null {
  return listing[BONUS_FIELD[fruit]] as number | null
}

type FruitSort = { fruit: CozyFarmFruit }

function CozyFarmShell() {
  const { user, logout } = useOutletContext<AuthOutletContext>()
  const { t, locale, setLocale } = useI18n()
  const [listings, setListings] = useState<CozyFarmListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameUid, setGameUid] = useState('')
  const [bonuses, setBonuses] = useState<Record<CozyFarmFruit, string>>({
    dragonfruit: '',
    carrot: '',
    bamboo: '',
    phantom: '',
    cranberry: '',
    orange: '',
  })
  const [saving, setSaving] = useState(false)
  const [fruitSort, setFruitSort] = useState<FruitSort | null>(null)
  const [cropInject, setCropInject] = useState<CozyFarmCropInject | null>(null)
  const [copiedUidId, setCopiedUidId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [optimizerOpen, setOptimizerOpen] = useState(false)

  const isSuperadmin = user.permissions.includes('roles:manage')
  const isAdmin = user.permissions.includes('admin:access')
  const canManageListing = (listing: CozyFarmListing) =>
    listing.userId === user.id || isAdmin
  const showManageColumn = isAdmin || listings.some((l) => l.userId === user.id)
  const emptyBonuses = (): Record<CozyFarmFruit, string> => ({
    dragonfruit: '',
    carrot: '',
    bamboo: '',
    phantom: '',
    cranberry: '',
    orange: '',
  })

  const resetForm = () => {
    setEditingId(null)
    setGameUid('')
    setBonuses(emptyBonuses())
  }

  const startEdit = (listing: CozyFarmListing) => {
    setEditingId(listing.id)
    setGameUid(listing.gameUid)
    setBonuses({
      dragonfruit: listing.bonusDragonfruit?.toString() ?? '',
      carrot: listing.bonusCarrot?.toString() ?? '',
      bamboo: listing.bonusBamboo?.toString() ?? '',
      phantom: listing.bonusPhantom?.toString() ?? '',
      cranberry: listing.bonusCranberry?.toString() ?? '',
      orange: listing.bonusOrange?.toString() ?? '',
    })
    setFormOpen(true)
    setError(null)
    window.requestAnimationFrame(() => {
      document.getElementById('cozy-farm-publish')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const onDeleteListing = async (listing: CozyFarmListing) => {
    if (!window.confirm(t('cozyFarm.deleteConfirm', { uid: listing.gameUid }))) return
    setSaving(true)
    setError(null)
    try {
      await api.deleteCozyFarmListing(listing.id)
      if (editingId === listing.id) resetForm()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cozyFarm.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listCozyFarmListings()
      setListings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cozyFarm.saveError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const sortedListings = useMemo(() => {
    if (!fruitSort) return listings
    const { fruit } = fruitSort
    return [...listings].sort((a, b) => {
      const av = listingBonus(a, fruit)
      const bv = listingBonus(b, fruit)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return bv - av
    })
  }, [listings, fruitSort])

  const toggleFruitSort = (fruit: CozyFarmFruit) => {
    setFruitSort((prev) => (prev?.fruit === fruit ? null : { fruit }))
  }

  const applyBonusToCalculator = (fruit: CozyFarmFruit, value: number | null) => {
    if (value == null) return
    setCropInject({ fruit, value, nonce: Date.now() })
    setOptimizerOpen(true)
    window.requestAnimationFrame(() => {
      document.getElementById('cozy-farm-optimizer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const copyUid = async (listingId: string, gameUid: string) => {
    try {
      await navigator.clipboard.writeText(gameUid)
      setCopiedUidId(listingId)
      window.setTimeout(() => {
        setCopiedUidId((prev) => (prev === listingId ? null : prev))
      }, 1500)
    } catch {
      setError(t('settings.msg.copyFail'))
    }
  }

  const buildPayload = (): CozyFarmListingInput | null => {
    const uid = gameUid.trim()
    if (!uid) return null
    const payload: CozyFarmListingInput = { gameUid: uid }
    let hasBonus = false
    for (const fruit of COZY_FARM_FRUITS) {
      const value = parseBonus(bonuses[fruit])
      payload[BONUS_FIELD[fruit]] = value
      if (value != null) hasBonus = true
    }
    if (!hasBonus) return null
    return payload
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const payload = buildPayload()
    if (!payload) {
      setError(t('cozyFarm.bonusRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        await api.updateCozyFarmListing(editingId, payload)
      } else {
        await api.createCozyFarmListing(payload)
      }
      resetForm()
      setFormOpen(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cozyFarm.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const onVote = async (listingId: string, value: 1 | -1) => {
    try {
      await api.voteCozyFarmListing(listingId, value)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cozyFarm.voteError'))
    }
  }

  return (
    <div className="app app--cozy">
      <div className="atmosphere" aria-hidden />

      <AppToolbar
        username={user.username}
        permissions={user.permissions}
        onLogout={logout}
        locale={locale}
        onLocaleChange={setLocale}
      />

      <header className="hero hero--cozy">
        <Link to="/" className="hero__home-link">
          ← {t('cozyFarm.backHome')}
        </Link>
        <h1 className="hero__title">{t('cozyFarm.title')}</h1>
        <nav className="hero__links" aria-label={t('cozyFarm.navAria')}>
          <a className="hero__link" href="#cozy-farm-strategy">
            {t('cozyFarm.navStrategy')}
          </a>
          <span className="hero__link-sep" aria-hidden>
            ·
          </span>
          <a className="hero__link" href="#cozy-farm-optimizer">
            {t('cozyFarm.navOptimizer')}
          </a>
          <span className="hero__link-sep" aria-hidden>
            ·
          </span>
          <a className="hero__link" href="#cozy-farm-support">
            {t('cozyFarm.navSupport')}
          </a>
        </nav>
      </header>

      <section id="cozy-farm-strategy" className="cozy-section cozy-anchor">
        <h2>{t('cozyFarm.infoTitle')}</h2>
        <p className="cozy-section__hint">{t('cozyFarm.infoDisclaimer')}</p>
        <ul className="cozy-info-list">
          <li>{t('cozyFarm.infoPoint1')}</li>
          <li>{t('cozyFarm.infoPoint2')}</li>
          <li>{t('cozyFarm.infoPoint3')}</li>
        </ul>
        <p className="cozy-sources">
          {t('cozyFarm.infoSources')}:{' '}
          <a href="https://roonby.com/2026/08/21/clash-of-critters-update-0-46-1-guide-new-polar-paw-tatari-horde-invasion-changes-more/" target="_blank" rel="noreferrer">
            Roonby 0.46.1
          </a>
          {' · '}
          <a href="https://mobi.gg/en/tips/clash-of-critters-cozy-farm/" target="_blank" rel="noreferrer">
            Mobi.gg
          </a>
          {' · '}
          <a href="https://cozy-farm-optimizer.netlify.app/" target="_blank" rel="noreferrer">
            Crop Optimizer
          </a>
        </p>
      </section>

      <section id="cozy-farm-optimizer" className="cozy-section cozy-anchor">
        <details
          className="trade-templates cozy-collapsible"
          open={optimizerOpen}
          onToggle={(e) => setOptimizerOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="trade-templates__summary">{t('cozyFarm.optimizerTitle')}</summary>
          <div className="trade-templates__body">
            <CozyFarmOptimizer injectCropValue={cropInject} />
          </div>
        </details>
      </section>

      <section id="cozy-farm-support" className="cozy-section cozy-anchor">
        <h2>{t('cozyFarm.boardTitle')}</h2>
        <p className="cozy-section__hint">{t('cozyFarm.boardFruitHint')}</p>

        {error && <p className="cozy-error">{error}</p>}

        <details
          id="cozy-farm-publish"
          className="trade-templates cozy-publish"
          open={formOpen}
          onToggle={(e) => {
            const open = (e.target as HTMLDetailsElement).open
            setFormOpen(open)
            if (!open && editingId) resetForm()
          }}
        >
          <summary className="trade-templates__summary">
            {editingId ? t('cozyFarm.editSummary') : t('cozyFarm.publishSummary')}
          </summary>
          <div className="trade-templates__body">
            <p className="trade-templates__hint">{t('cozyFarm.boardHint')}</p>
            <form className="cozy-form" onSubmit={(e) => void onSubmit(e)}>
              <label className="cozy-field">
                <span>{t('cozyFarm.gameUid')}</span>
                <input
                  value={gameUid}
                  onChange={(e) => setGameUid(e.target.value)}
                  required
                  maxLength={64}
                  autoComplete="off"
                />
              </label>

              <fieldset className="cozy-bonuses">
                <legend>{t('cozyFarm.bonuses')}</legend>
                <div className="cozy-optimizer__crops">
                  {COZY_FARM_FRUITS.map((fruit) => (
                    <label key={fruit} className="cozy-field">
                      <span>{t(FRUIT_LABEL[fruit])}</span>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        step="any"
                        value={bonuses[fruit]}
                        onChange={(e) =>
                          setBonuses((prev) => ({ ...prev, [fruit]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="cozy-form__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {editingId ? t('cozyFarm.update') : t('cozyFarm.publish')}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn--outline"
                    disabled={saving}
                    onClick={() => {
                      resetForm()
                      setFormOpen(false)
                    }}
                  >
                    {t('cozyFarm.cancelEdit')}
                  </button>
                )}
              </div>
            </form>
          </div>
        </details>

        {loading ? (
          <p className="panel__status">{t('auth.loading')}</p>
        ) : sortedListings.length === 0 ? (
          <p className="panel__status">{t('cozyFarm.empty')}</p>
        ) : (
          <div className="cozy-table-wrap">
            <table className="cozy-table">
              <thead>
                <tr>
                  <th>{t('cozyFarm.gameUid')}</th>
                  {COZY_FARM_FRUITS.map((fruit) => {
                    const active = fruitSort?.fruit === fruit
                    const label = t(FRUIT_LABEL[fruit])
                    return (
                      <th key={fruit}>
                        <button
                          type="button"
                          className={`cozy-table__sort${active ? ' is-active' : ''}`}
                          onClick={() => toggleFruitSort(fruit)}
                          title={`${label} — ${t('cozyFarm.sortByFruit')}`}
                          aria-label={`${label} — ${t('cozyFarm.sortByFruit')}`}
                        >
                          <img
                            className="cozy-table__fruit-icon"
                            src={FRUIT_ICON[fruit]}
                            alt=""
                            width={28}
                            height={28}
                            draggable={false}
                          />
                          {active && <span className="cozy-table__sort-marker" aria-hidden>↓</span>}
                        </button>
                      </th>
                    )
                  })}
                  <th>{t('cozyFarm.rating')}</th>
                  {showManageColumn && <th />}
                </tr>
              </thead>
              <tbody>
                {sortedListings.map((listing) => {
                  const score = listing.likes - listing.dislikes
                  const canVote = listing.userId !== user.id || isSuperadmin
                  const canManage = canManageListing(listing)
                  const ratingDetail = t('cozyFarm.ratingDetail', {
                    likes: listing.likes,
                    dislikes: listing.dislikes,
                  })
                  return (
                  <tr key={listing.id}>
                    <td>
                      <button
                        type="button"
                        className={`cozy-table__uid${copiedUidId === listing.id ? ' is-copied' : ''}`}
                        onClick={() => void copyUid(listing.id, listing.gameUid)}
                        title={t('cozyFarm.copyUid')}
                      >
                        {copiedUidId === listing.id ? t('common.copied') : listing.gameUid}
                      </button>
                    </td>
                    {COZY_FARM_FRUITS.map((fruit) => {
                      const value = listingBonus(listing, fruit)
                      return (
                        <td
                          key={fruit}
                          className={value != null ? 'cozy-table__bonus' : undefined}
                          title={value != null ? t('cozyFarm.applyToCalculator') : undefined}
                          onDoubleClick={() => applyBonusToCalculator(fruit, value)}
                        >
                          {formatBonus(value)}
                        </td>
                      )
                    })}
                    <td>
                      <div className="cozy-rating">
                        {canVote ? (
                          <button
                            type="button"
                            className={`cozy-rating__arrow${listing.myVote === 1 ? ' is-active' : ''}`}
                            onClick={() => void onVote(listing.id, 1)}
                            aria-label={t('cozyFarm.likes')}
                          >
                            ▲
                          </button>
                        ) : (
                          <span className="cozy-rating__arrow is-spacer" aria-hidden>
                            ▲
                          </span>
                        )}
                        <span
                          className={`cozy-rating__score${score > 0 ? ' is-pos' : score < 0 ? ' is-neg' : ''}`}
                          title={ratingDetail}
                        >
                          {score}
                        </span>
                        {canVote ? (
                          <button
                            type="button"
                            className={`cozy-rating__arrow${listing.myVote === -1 ? ' is-active' : ''}`}
                            onClick={() => void onVote(listing.id, -1)}
                            aria-label={t('cozyFarm.dislikes')}
                          >
                            ▼
                          </button>
                        ) : (
                          <span className="cozy-rating__arrow is-spacer" aria-hidden>
                            ▼
                          </span>
                        )}
                      </div>
                    </td>
                    {showManageColumn && (
                      <td>
                        {canManage && (
                          <div className="cozy-admin-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={saving}
                              onClick={() => startEdit(listing)}
                              title={t('cozyFarm.edit')}
                              aria-label={t('cozyFarm.edit')}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              disabled={saving}
                              onClick={() => void onDeleteListing(listing)}
                              title={t('cozyFarm.delete')}
                              aria-label={t('cozyFarm.delete')}
                            >
                              <svg
                                className="icon-btn__svg"
                                viewBox="0 0 16 16"
                                width={14}
                                height={14}
                                aria-hidden
                              >
                                <path
                                  fill="currentColor"
                                  d="M5.5 1a.5.5 0 0 0-.5.5V2H2.5a.5.5 0 0 0 0 1H3v9.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V3h.5a.5.5 0 0 0 0-1H11v-.5a.5.5 0 0 0-.5-.5h-5ZM5 3h6v9.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5V3Zm1.5 1.5a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 1 0v-6a.5.5 0 0 0-.5-.5Zm3 0a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 1 0v-6a.5.5 0 0 0-.5-.5Z"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export function CozyFarmPage() {
  const { locale, setLocale } = usePersistedLocale()

  useEffect(() => {
    document.documentElement.lang = localeTag(locale)
  }, [locale])

  return (
    <I18nProvider locale={locale} setLocale={setLocale}>
      <CozyFarmShell />
    </I18nProvider>
  )
}
