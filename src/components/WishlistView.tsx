import { useMemo, useState } from 'react'
import type { Account, Card } from '../types'
import { useI18n } from '../i18n'
import { AccountNeedToggles } from './AccountNeedToggles'
import { CardItem } from './CardItem'
import { SearchField } from './SearchField'

interface Props {
  accounts: Account[]
  cards: Card[]
  neededBy: Record<string, string[]>
  owned: Record<string, number>
  tradeNeedCardIds: Set<string>
  readOnly?: boolean
  onToggleNeeded?: (cardId: string, accountId: string) => void
  onSetNeededForAll?: (cardId: string, needed: boolean) => void
  onToggleStar?: (cardId: string) => void
}

export function WishlistView({
  accounts,
  cards: allCards,
  neededBy,
  owned,
  tradeNeedCardIds,
  readOnly = false,
  onToggleNeeded,
  onSetNeededForAll,
  onToggleStar,
}: Props) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [accountFilter, setAccountFilter] = useState<string | 'all' | 'missing'>('all')

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list: Card[] = []

    for (const c of allCards) {
      const qty = owned[c.id] ?? 0
      const needed = neededBy[c.id] ?? []
      const isMissing = qty === 0
      const isMarked = needed.length > 0
      const isTradeNeed = tradeNeedCardIds.has(c.id)

      if (!isMissing && !isMarked && !isTradeNeed) continue

      if (accountFilter === 'missing' && !isMissing) continue
      if (
        accountFilter !== 'all' &&
        accountFilter !== 'missing' &&
        !needed.includes(accountFilter)
      ) {
        continue
      }

      if (
        q &&
        !c.name.toLowerCase().includes(q) &&
        !c.setName.toLowerCase().includes(q) &&
        !String(c.number).includes(q)
      ) {
        continue
      }

      list.push(c)
    }

    return list.sort((a, b) => a.number - b.number)
  }, [allCards, owned, neededBy, tradeNeedCardIds, accountFilter, query])

  const missingCount = useMemo(
    () => allCards.filter((c) => (owned[c.id] ?? 0) === 0).length,
    [allCards, owned],
  )

  return (
    <section className="panel">
      <header className="panel__head">
        <div>
          <h2>{t('wishlist.title')}</h2>
          <p>{t('wishlist.lead', { n: missingCount })}</p>
        </div>
      </header>

      <div className="filters">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t('wishlist.search')}
        />
        <select
          className="select"
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value as typeof accountFilter)}
        >
          <option value="all">{t('wishlist.filterAll')}</option>
          <option value="missing">{t('wishlist.filterMissing')}</option>
          {accounts.map((a, i) => (
            <option key={a.id} value={a.id}>
              {t('wishlist.filterAccount', { name: a.name, n: i + 1 })}
            </option>
          ))}
        </select>
      </div>

      {cards.length === 0 ? (
        <p className="empty">{t('wishlist.empty')}</p>
      ) : (
        <div className="card-grid">
          {cards.map((c) => {
            const qty = owned[c.id] ?? 0
            const needed = neededBy[c.id] ?? []
            const isTradeNeed = tradeNeedCardIds.has(c.id)
            const allOn = accounts.length > 0 && accounts.every((a) => needed.includes(a.id))
            return (
              <CardItem
                key={c.id}
                card={c}
                qty={qty}
                dimmed={qty > 0 && needed.length === 0 && !isTradeNeed}
                actions={
                  readOnly ? (
                    <>
                      {qty === 0 && <span className="pill pill--warn">×0</span>}
                      {needed.length > 0 && (
                        <span className="pill pill--need">
                          {needed.length > 0 ? '♥' : ''}
                        </span>
                      )}
                    </>
                  ) : (
                  <>
                    {qty === 0 && <span className="pill pill--warn">×0</span>}
                    {isTradeNeed && (
                      <span className="pill pill--need" title={t('need.forTradeTitle')}>
                        {t('need.forTradePill')}
                      </span>
                    )}
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
          })}
        </div>
      )}
    </section>
  )
}
