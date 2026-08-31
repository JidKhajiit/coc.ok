import { useMemo, useState } from 'react'
import { CARDS, SETS } from '../data/cards'
import type { Account, Card, CardColor, Rarity } from '../types'
import { useI18n } from '../i18n'
import { AccountNeedToggles } from './AccountNeedToggles'
import { CardItem } from './CardItem'
import { SearchField } from './SearchField'
import { TradeTemplates } from './TradeTemplates'

type SortMode = 'number' | 'rarity-asc' | 'rarity-desc'

interface Props {
  username: string
  owned: Record<string, number>
  accounts: Account[]
  neededBy: Record<string, string[]>
  reservedByCard: Record<string, number>
  reservedPartners: Record<string, string[]>
  tradeNeedCardIds: Set<string>
  readOnly?: boolean
  onAdjust?: (cardId: string, delta: number) => void
  onToggleNeeded?: (cardId: string, accountId: string) => void
  onSetNeededForAll?: (cardId: string, needed: boolean) => void
  onToggleStar?: (cardId: string) => void
}

function compareCards(a: Card, b: Card, sort: SortMode): number {
  if (sort === 'rarity-asc') return a.rarity - b.rarity || a.number - b.number
  if (sort === 'rarity-desc') return b.rarity - a.rarity || a.number - b.number
  return a.number - b.number
}

export function CollectionView({
  username,
  owned,
  accounts,
  neededBy,
  reservedByCard,
  reservedPartners,
  tradeNeedCardIds,
  readOnly = false,
  onAdjust,
  onToggleNeeded,
  onSetNeededForAll,
  onToggleStar,
}: Props) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [setId, setSetId] = useState<string | 'all'>('all')
  const [rarity, setRarity] = useState<Rarity | 'all'>('all')
  const [color, setColor] = useState<CardColor | 'all'>('all')
  const [sort, setSort] = useState<SortMode>('number')
  const [onlyOwned, setOnlyOwned] = useState(false)
  const [onlyTradeable, setOnlyTradeable] = useState(false)
  const [hideUnknown, setHideUnknown] = useState(false)
  const [onlyNeeded, setOnlyNeeded] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = CARDS.filter((c) => {
      if (setId !== 'all' && c.setId !== setId) return false
      if (rarity !== 'all' && c.rarity !== rarity) return false
      if (color !== 'all' && c.color !== color) return false
      if (hideUnknown && c.unknownName) return false
      const qty = owned[c.id] ?? 0
      const reserved = reservedByCard[c.id] ?? 0
      const needed = neededBy[c.id] ?? []
      if (onlyOwned && qty <= 0) return false
      if (onlyTradeable && qty - 1 - reserved < 1) return false
      if (onlyNeeded && needed.length === 0) return false
      if (
        q &&
        !c.name.toLowerCase().includes(q) &&
        !c.setName.toLowerCase().includes(q) &&
        !String(c.number).includes(q)
      ) {
        return false
      }
      return true
    })
    return [...list].sort((a, b) => compareCards(a, b, sort))
  }, [
    query,
    setId,
    rarity,
    color,
    sort,
    onlyOwned,
    onlyTradeable,
    hideUnknown,
    onlyNeeded,
    owned,
    reservedByCard,
    neededBy,
  ])

  const grouped = useMemo(() => {
    if (sort !== 'number') return null
    const map = new Map<string, Card[]>()
    for (const c of filtered) {
      const list = map.get(c.setId) ?? []
      list.push(c)
      map.set(c.setId, list)
    }
    return SETS.filter((s) => map.has(s.id)).map((s) => ({
      set: s,
      cards: map.get(s.id)!,
    }))
  }, [filtered, sort])

  function renderCard(c: Card) {
    const qty = owned[c.id] ?? 0
    const reserved = reservedByCard[c.id] ?? 0
    const tradeable = Math.max(0, qty - 1 - reserved)
    const needed = neededBy[c.id] ?? []
    const allOn = accounts.every((a) => needed.includes(a.id))
    return (
      <CardItem
        key={c.id}
        card={c}
        qty={qty}
        tradeable={tradeable}
        reserved={reserved}
        reservedFor={reservedPartners[c.id]}
        dimmed={qty === 0}
        showSet={sort !== 'number'}
        actions={
          readOnly ? undefined : (
          <>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onAdjust?.(c.id, -1)}
              disabled={qty === 0}
              aria-label={t('collection.qtyDown')}
            >
              −
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onAdjust?.(c.id, 1)}
              aria-label={t('collection.qtyUp')}
            >
              +
            </button>
            <AccountNeedToggles
              accounts={accounts}
              neededAccountIds={needed}
              onToggle={(accountId) => onToggleNeeded?.(c.id, accountId)}
              onToggleAll={() => onSetNeededForAll?.(c.id, !allOn)}
              onToggleStar={() => onToggleStar?.(c.id)}
            />
          </>
          )
        }
      />
    )
  }

  const filtersActive =
    setId !== 'all' ||
    rarity !== 'all' ||
    color !== 'all' ||
    onlyOwned ||
    onlyTradeable ||
    onlyNeeded ||
    hideUnknown ||
    query.trim().length > 0

  function resetFilters() {
    setQuery('')
    setSetId('all')
    setRarity('all')
    setColor('all')
    setOnlyOwned(false)
    setOnlyTradeable(false)
    setOnlyNeeded(false)
    setHideUnknown(false)
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <div>
          <p className="panel__eyebrow">{t('collection.title')}</p>
          <h2 className="panel__title">
            <span className="panel__username">{username}</span>
          </h2>
        </div>
      </header>

      {!readOnly && (
        <TradeTemplates
          owned={owned}
          neededBy={neededBy}
          reservedByCard={reservedByCard}
          tradeNeedCardIds={tradeNeedCardIds}
        />
      )}

      <div className="toolbar">
        <div className="toolbar__row">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={t('collection.search')}
            className="toolbar__search"
          />
          <div className="seg" role="group" aria-label={t('collection.sort')}>
            {(
              [
                ['number', '№'],
                ['rarity-asc', '★↑'],
                ['rarity-desc', '★↓'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`seg__btn ${sort === value ? 'is-active' : ''}`}
                onClick={() => setSort(value)}
                title={
                  value === 'number'
                    ? t('collection.sort.number')
                    : value === 'rarity-asc'
                      ? t('collection.sort.rarityAsc')
                      : t('collection.sort.rarityDesc')
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar__row toolbar__row--wrap">
          <label className="toolbar__field">
            <span>{t('collection.set')}</span>
            <select
              className="select select--slim"
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
            >
              <option value="all">{t('common.all')}</option>
              {SETS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name.replace(/ Set$/, '')}
                </option>
              ))}
            </select>
          </label>

          <div className="chip-row" role="group" aria-label={t('collection.rarity')}>
            <button
              type="button"
              className={`chip ${rarity === 'all' ? 'is-active' : ''}`}
              onClick={() => setRarity('all')}
            >
              {t('collection.rarityAll')}
            </button>
            {([1, 2, 3, 4, 5] as Rarity[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`chip ${rarity === r ? 'is-active' : ''}`}
                onClick={() => setRarity(rarity === r ? 'all' : r)}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="chip-row" role="group" aria-label={t('collection.color')}>
            {(
              [
                ['all', t('collection.colorAll')],
                ['blue', t('collection.colorBlue')],
                ['gold', t('collection.colorGold')],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip chip--${value} ${color === value ? 'is-active' : ''}`}
                onClick={() => setColor(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar__row toolbar__row--wrap">
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${onlyOwned ? 'is-active' : ''}`}
              onClick={() => setOnlyOwned((v) => !v)}
            >
              {t('collection.filterOwned')}
            </button>
            <button
              type="button"
              className={`chip ${onlyTradeable ? 'is-active' : ''}`}
              onClick={() => setOnlyTradeable((v) => !v)}
            >
              {t('collection.filterTrade')}
            </button>
            <button
              type="button"
              className={`chip ${onlyNeeded ? 'is-active' : ''}`}
              onClick={() => setOnlyNeeded((v) => !v)}
            >
              {t('collection.filterNeeded')}
            </button>
            <button
              type="button"
              className={`chip ${hideUnknown ? 'is-active' : ''}`}
              onClick={() => setHideUnknown((v) => !v)}
            >
              {t('collection.filterHideUnknown')}
            </button>
          </div>

          {filtersActive && (
            <button type="button" className="toolbar__reset" onClick={resetFilters}>
              {t('collection.reset')}
            </button>
          )}

          <span className="toolbar__count">{t('collection.count', { n: filtered.length })}</span>
        </div>
      </div>

      {grouped
        ? grouped.map(({ set, cards }) => {
            const ownedInSet = cards.filter((c) => (owned[c.id] ?? 0) > 0).length
            return (
              <div key={set.id} className="set-block">
                <div className="set-block__head">
                  <h3>{set.name}</h3>
                  <span>
                    #{set.from}–{set.to} · {ownedInSet}/{cards.length}
                  </span>
                </div>
                <div className="card-grid">{cards.map(renderCard)}</div>
              </div>
            )
          })
        : filtered.length > 0 && <div className="card-grid">{filtered.map(renderCard)}</div>}

      {filtered.length === 0 && <p className="empty">{t('collection.empty')}</p>}
    </section>
  )
}
