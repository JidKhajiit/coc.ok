import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { rarityLabel } from '../data/cards'
import type { Card, PotentialTrade, TradeRecord, TradeSource } from '../types'
import { localeTag, useI18n, type TranslateFn } from '../i18n'
import { CardPicker } from './CardPicker'

interface Props {
  cards: Card[]
  owned: Record<string, number>
  trades: TradeRecord[]
  potentialTrades: PotentialTrade[]
  reservedByCard: Record<string, number>
  onAdd: (input: {
    givenCardId: string
    receivedCardId?: string
    partner?: string
    note?: string
    source?: TradeSource
  }) => void
  onRemove: (id: string) => void
  onAddPotential: (input: {
    givenCardId: string
    receivedCardId?: string
    partner?: string
    note?: string
  }) => boolean
  onUpdatePotential: (
    id: string,
    input: {
      givenCardId: string
      receivedCardId?: string
      partner?: string
      note?: string
    },
  ) => boolean
  onRemovePotential: (id: string) => void
  onConfirmPotential: (id: string) => void
  onArchivePotential: (id: string) => void
}

function TradeCardRef({
  card,
  reserved,
  missing,
  ownedQty,
}: {
  card: Card
  reserved?: boolean
  missing?: boolean
  ownedQty?: number
}) {
  const { t } = useI18n()
  return (
    <span
      className={[
        'trade-chip',
        `trade-chip--${card.color}`,
        reserved && !missing ? 'trade-chip--reserved' : '',
        missing ? 'trade-chip--missing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      title={[
        card.setName,
        card.color === 'gold' ? t('trades.chip.gold') : t('trades.chip.blue'),
        missing ? t('trades.chip.missing') : reserved ? 'reserved' : '',
        ownedQty !== undefined ? t('trades.chip.owned', { n: ownedQty }) : '',
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      <span className="trade-chip__num">#{card.number}</span>
      <span className="trade-chip__name">
        {card.unknownName ? t('common.unnamed') : card.name}
      </span>
      <span className="trade-chip__meta">
        {rarityLabel(card.rarity)}
        {missing ? t('trades.chip.none') : reserved ? ' · rsv' : ''}
        {ownedQty !== undefined ? ` · ×${ownedQty}` : ''}
      </span>
    </span>
  )
}

function TradeReceiveUnset() {
  const { t } = useI18n()
  return (
    <span className="trade-chip trade-chip--unset" title={t('trades.receiveUnset')}>
      <span className="trade-chip__name">{t('trades.receiveUnset')}</span>
    </span>
  )
}

/** Есть ли повторка для обмена (нужно минимум 2 копии) */
function canGiveAway(qty: number): boolean {
  return qty > 1
}

function tradeSourceOf(t: TradeRecord): TradeSource {
  return t.source === 'observed' || t.source === 'cancelled' ? t.source : 'completed'
}

function tradeSourceLabel(source: TradeSource, t: TranslateFn): string | null {
  if (source === 'observed') return t('trades.badgeArchive')
  if (source === 'cancelled') return t('trades.badgeCancelled')
  return null
}

const HISTORY_PAGE_SIZE = 5

export function TradesView({
  cards,
  owned,
  trades,
  potentialTrades,
  reservedByCard,
  onAdd,
  onRemove,
  onAddPotential,
  onUpdatePotential,
  onRemovePotential,
  onConfirmPotential,
  onArchivePotential,
}: Props) {
  const { t, locale } = useI18n()
  const [givenId, setGivenId] = useState('')
  const [receivedId, setReceivedId] = useState('')
  const [partner, setPartner] = useState('')
  const [note, setNote] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [historyMode, setHistoryMode] = useState<'completed' | 'observed'>('completed')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'mine' | 'archive'>('mine')
  const [historyPage, setHistoryPage] = useState(0)

  const [pGivenId, setPGivenId] = useState('')
  const [pReceivedId, setPReceivedId] = useState('')
  const [pPartner, setPPartner] = useState('')
  const [pNote, setPNote] = useState('')
  const [potentialFormOpen, setPotentialFormOpen] = useState(false)
  const [editingPotentialId, setEditingPotentialId] = useState<string | null>(null)
  const [potentialError, setPotentialError] = useState('')
  const potentialFormRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!potentialFormOpen || !editingPotentialId) return
    const el = potentialFormRef.current
    if (!el) return
    const frame = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [potentialFormOpen, editingPotentialId])

  const tradeable = useMemo(
    () =>
      cards.filter((c) => (owned[c.id] ?? 0) > 1).sort((a, b) => a.number - b.number),
    [cards, owned],
  )

  const allCards = useMemo(() => [...cards].sort((a, b) => a.number - b.number), [cards])
  const cardById = useMemo(
    () => Object.fromEntries(cards.map((card) => [card.id, card])) as Record<string, Card>,
    [cards],
  )

  const filteredTrades = useMemo(() => {
    if (historyFilter === 'all') return trades
    if (historyFilter === 'mine') {
      return trades.filter((t) => tradeSourceOf(t) === 'completed')
    }
    return trades.filter((t) => tradeSourceOf(t) !== 'completed')
  }, [trades, historyFilter])

  const historyTotalPages = Math.max(1, Math.ceil(filteredTrades.length / HISTORY_PAGE_SIZE))
  const historySafePage = Math.min(historyPage, historyTotalPages - 1)

  const paginatedTrades = useMemo(() => {
    const start = historySafePage * HISTORY_PAGE_SIZE
    return filteredTrades.slice(start, start + HISTORY_PAGE_SIZE)
  }, [filteredTrades, historySafePage])

  const isArchiveForm = historyMode === 'observed'
  const givenOptions = isArchiveForm ? allCards : tradeable

  const pGivenMissing = pGivenId ? !canGiveAway(owned[pGivenId] ?? 0) : false

  function formatPotentialGiven(c: Card): string {
    const qty = owned[c.id] ?? 0
    const reserved = reservedByCard[c.id] ?? 0
    const missing = !canGiveAway(qty)
    const name = c.unknownName ? t('common.unnamed') : c.name
    const suffix = missing
      ? qty === 0
        ? t('trades.notInCollection')
        : t('trades.noDuplicate')
      : ` · ×${qty}${reserved > 0 ? `, rsv ${reserved}` : ''}`
    return `#${c.number} ${name}${suffix}`
  }

  function formatPotentialReceived(c: Card): string {
    const name = c.unknownName ? t('common.unnamed') : c.name
    const qty = owned[c.id] ?? 0
    return `#${c.number} ${name} · ${c.setName} · ×${qty}`
  }

  function formatHistoryGiven(c: Card): string {
    const name = c.unknownName ? t('common.unnamed') : c.name
    const color = c.color === 'gold' ? t('card.gold') : t('card.blue')
    const qty = !isArchiveForm ? ` ×${owned[c.id]}` : ''
    return `#${c.number} ${name} · ${c.setName} (${c.rarity}★, ${color})${qty}`
  }

  function formatHistoryReceived(c: Card): string {
    const name = c.unknownName ? t('common.unnamed') : c.name
    const color = c.color === 'gold' ? t('card.gold') : t('card.blue')
    return `#${c.number} ${name} · ${c.setName} (${c.rarity}★, ${color})`
  }

  function resetPotentialForm() {
    setPGivenId('')
    setPReceivedId('')
    setPPartner('')
    setPNote('')
    setEditingPotentialId(null)
    setPotentialError('')
  }

  function openCreatePotential() {
    if (potentialFormOpen && !editingPotentialId) {
      setPotentialFormOpen(false)
      resetPotentialForm()
      return
    }
    resetPotentialForm()
    setPotentialFormOpen(true)
  }

  function startEditPotential(trade: PotentialTrade) {
    setEditingPotentialId(trade.id)
    setPGivenId(trade.givenCardId)
    setPReceivedId(trade.receivedCardId ?? '')
    setPPartner(trade.partner ?? '')
    setPNote(trade.note ?? '')
    setPotentialError('')
    setPotentialFormOpen(true)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!givenId || (!!receivedId && givenId === receivedId)) return
    onAdd({
      givenCardId: givenId,
      receivedCardId: receivedId || undefined,
      partner: partner.trim() || undefined,
      note: note.trim() || undefined,
      source: historyMode,
    })
    setGivenId('')
    setReceivedId('')
    setPartner('')
    setNote('')
    setFormOpen(false)
  }

  function submitPotential(e: FormEvent) {
    e.preventDefault()
    setPotentialError('')
    if (!pGivenId) return
    if (pReceivedId && pGivenId === pReceivedId) return

    const payload = {
      givenCardId: pGivenId,
      receivedCardId: pReceivedId || undefined,
      partner: pPartner.trim() || undefined,
      note: pNote.trim() || undefined,
    }

    const ok = editingPotentialId
      ? onUpdatePotential(editingPotentialId, payload)
      : onAddPotential(payload)

    if (!ok) {
      setPotentialError(t('trades.saveFail'))
      return
    }

    resetPotentialForm()
    setPotentialFormOpen(false)
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <div>
          <h2>{t('trades.title')}</h2>
        </div>
      </header>

      <div className="trade-section">
        <div className="trade-section__head">
          <div className="trade-section__title">
            <h3>{t('trades.potential')}</h3>
            <span className="help-tip">
              <button
                type="button"
                className="help-tip__btn"
                aria-label={t('trades.potentialHelpAria')}
              >
                ?
              </button>
              <span className="help-tip__popup" role="tooltip">
                {t('trades.potentialHelp')}
              </span>
            </span>
          </div>
          <button type="button" className="btn btn--primary" onClick={openCreatePotential}>
            {potentialFormOpen && !editingPotentialId ? t('common.close') : t('trades.plan')}
          </button>
        </div>

        {potentialFormOpen && (
          <form
            ref={potentialFormRef}
            className="trade-form trade-form--potential"
            onSubmit={submitPotential}
          >
            {editingPotentialId && (
              <p className="form-info">{t('trades.editingPotential')}</p>
            )}
            <label>
              {t('trades.give')}
              <CardPicker
                value={pGivenId}
                onChange={setPGivenId}
                cards={allCards}
                formatOption={formatPotentialGiven}
                required
              />
            </label>

            <label>
              {t('trades.wantOptional')}
              <CardPicker
                value={pReceivedId}
                onChange={setPReceivedId}
                cards={allCards}
                formatOption={formatPotentialReceived}
              />
            </label>

            <label>
              {t('trades.partnerOptional')}
              <input
                className="input"
                value={pPartner}
                onChange={(e) => setPPartner(e.target.value)}
                placeholder={t('trades.partnerPh')}
              />
            </label>

            <label>
              {t('common.note')}
              <input
                className="input"
                value={pNote}
                onChange={(e) => setPNote(e.target.value)}
                placeholder={t('common.optional')}
              />
            </label>

            {pGivenMissing && <p className="form-warn">{t('trades.noCopyWarn')}</p>}
            {potentialError && <p className="form-warn">{potentialError}</p>}

            <div className="trade-form__actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!pGivenId || (!!pReceivedId && pGivenId === pReceivedId)}
              >
                {editingPotentialId ? t('trades.saveChanges') : t('trades.savePotential')}
              </button>
              {editingPotentialId && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    resetPotentialForm()
                    setPotentialFormOpen(false)
                  }}
                >
                  {t('common.cancel')}
                </button>
              )}
            </div>
          </form>
        )}

        {potentialTrades.length === 0 ? (
          <p className="empty">{t('trades.potentialEmpty')}</p>
        ) : (
          <ul className="trade-list">
            {potentialTrades.map((trade) => {
              const g = cardById[trade.givenCardId]
              if (!g) return null
              const r = trade.receivedCardId ? cardById[trade.receivedCardId] : undefined
              const missing = !canGiveAway(owned[trade.givenCardId] ?? 0)
              return (
                <li key={trade.id} className="trade-row trade-row--potential">
                  <div className="trade-row__body">
                    <div className="trade-row__cards">
                      <TradeCardRef card={g} reserved={!missing} missing={missing} />
                      <span className="trade-row__arrow" aria-hidden>
                        →
                      </span>
                      {r ? (
                        <TradeCardRef
                          card={r}
                          ownedQty={owned[trade.receivedCardId!] ?? 0}
                        />
                      ) : (
                        <TradeReceiveUnset />
                      )}
                    </div>
                    <div className="trade-row__meta">
                      {trade.partner && (
                        <span className="trade-row__partner">@{trade.partner}</span>
                      )}
                      {trade.note && <span className="trade-row__note">{trade.note}</span>}
                    </div>
                  </div>
                  <div className="trade-row__actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => startEditPotential(trade)}
                      title={t('trades.edit')}
                      aria-label={t('trades.edit')}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--ok"
                      onClick={() => {
                        if (window.confirm(t('trades.confirmCompleted'))) {
                          onConfirmPotential(trade.id)
                        }
                      }}
                      title={t('trades.completed')}
                      aria-label={t('trades.completed')}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        if (window.confirm(t('trades.confirmArchive'))) {
                          onArchivePotential(trade.id)
                        }
                      }}
                      title={t('trades.archive')}
                      aria-label={t('trades.archive')}
                    >
                      <svg
                        className="icon-btn__svg"
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        aria-hidden
                      >
                        <path
                          fill="currentColor"
                          d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5V4H2V2.5ZM2 5.5h12V13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13V5.5Zm4 2.25h4v1.5H6v-1.5Z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => {
                        if (window.confirm(t('trades.confirmRemovePotential'))) {
                          onRemovePotential(trade.id)
                        }
                      }}
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                    >
                      ×
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="trade-section">
        <div className="trade-section__head">
          <h3>{t('trades.history')}</h3>
          <div className="trade-section__tools">
            <select
              className="select select--compact"
              value={historyFilter}
              onChange={(e) => {
                setHistoryFilter(e.target.value as 'all' | 'mine' | 'archive')
                setHistoryPage(0)
              }}
              aria-label={t('trades.filterAria')}
            >
              <option value="all">{t('trades.filterAll')}</option>
              <option value="mine">{t('trades.filterMine')}</option>
              <option value="archive">{t('trades.filterArchive')}</option>
            </select>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? t('common.close') : t('trades.newTrade')}
            </button>
          </div>
        </div>

        {formOpen && (
          <form className="trade-form" onSubmit={submit}>
            <div className="history-mode" role="group" aria-label={t('trades.modeAria')}>
              <button
                type="button"
                className={`history-mode__btn ${!isArchiveForm ? 'is-active' : ''}`}
                onClick={() => {
                  setHistoryMode('completed')
                  setGivenId('')
                }}
              >
                {t('trades.modeMine')}
              </button>
              <button
                type="button"
                className={`history-mode__btn ${isArchiveForm ? 'is-active' : ''}`}
                onClick={() => {
                  setHistoryMode('observed')
                  setGivenId('')
                }}
              >
                {t('trades.modeArchive')}
              </button>
            </div>

            {isArchiveForm && <p className="form-info">{t('trades.archiveInfo')}</p>}

            <label>
              {isArchiveForm ? t('trades.gave') : t('trades.giveDup')}
              <CardPicker
                value={givenId}
                onChange={setGivenId}
                cards={givenOptions}
                formatOption={formatHistoryGiven}
                required
              />
            </label>

            <label>
              {isArchiveForm ? t('trades.gotOptional') : t('trades.receiveOptional')}
              <CardPicker
                value={receivedId}
                onChange={setReceivedId}
                cards={allCards}
                formatOption={formatHistoryReceived}
              />
            </label>

            <label>
              {t('trades.partnerLabel')}
              <input
                className="input"
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
                placeholder={t('trades.partnerPlayer')}
              />
            </label>

            <label>
              {t('common.note')}
              <input
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('trades.notePh')}
              />
            </label>

            {!isArchiveForm && tradeable.length === 0 && (
              <p className="form-warn">{t('trades.noTradeable')}</p>
            )}

            <button
              type="submit"
              className="btn btn--primary"
              disabled={!givenId || (!!receivedId && givenId === receivedId)}
            >
              {isArchiveForm ? t('trades.toArchive') : t('trades.saveTrade')}
            </button>
          </form>
        )}

        {filteredTrades.length === 0 ? (
          <p className="empty">
            {trades.length === 0 ? t('trades.historyEmpty') : t('trades.historyFilterEmpty')}
          </p>
        ) : (
          <>
            <ul className="trade-list">
              {paginatedTrades.map((trade) => {
              const g = cardById[trade.givenCardId]
              if (!g) return null
              const r = trade.receivedCardId ? cardById[trade.receivedCardId] : undefined
              const date = new Date(trade.createdAt)
              const source = tradeSourceOf(trade)
              const sourceLabel = tradeSourceLabel(source, t)
              return (
                <li key={trade.id} className="trade-row">
                  <div className="trade-row__body">
                    <div className="trade-row__cards">
                      <TradeCardRef card={g} />
                      <span className="trade-row__arrow" aria-hidden>
                        →
                      </span>
                      {r ? <TradeCardRef card={r} /> : <TradeReceiveUnset />}
                    </div>
                    <div className="trade-row__meta">
                      {sourceLabel && (
                        <span
                          className={`pill ${
                            source === 'cancelled' ? 'pill--warn' : 'pill--archive'
                          }`}
                        >
                          {sourceLabel}
                        </span>
                      )}
                      {trade.partner && (
                        <span className="trade-row__partner">@{trade.partner}</span>
                      )}
                      <time className="trade-row__time" dateTime={trade.createdAt}>
                        {date.toLocaleString(localeTag(locale), {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                      {trade.note && <span className="trade-row__note">{trade.note}</span>}
                    </div>
                  </div>
                  <div className="trade-row__actions">
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => {
                        if (window.confirm(t('trades.confirmDeleteHistory'))) {
                          onRemove(trade.id)
                        }
                      }}
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                    >
                      <svg
                        className="icon-btn__svg"
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        aria-hidden
                      >
                        <path
                          fill="currentColor"
                          d="M6 1h4l.5 1H14v1.5H2V2h3.5L6 1Zm1 4v7H6V5h1Zm3 0v7H9V5h1ZM3.5 4H13l-.7 9.2A1.5 1.5 0 0 1 10.8 14.5H5.2a1.5 1.5 0 0 1-1.5-1.3L3.5 4Z"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              )
            })}
            </ul>

            {filteredTrades.length > HISTORY_PAGE_SIZE && (
              <nav
                className="trade-history-pager"
                aria-label={t('trades.historyPagerAria')}
              >
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={historySafePage <= 0}
                  onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                >
                  {t('trades.historyPrev')}
                </button>
                <span className="trade-history-pager__info">
                  {t('trades.historyPage', {
                    page: historySafePage + 1,
                    total: historyTotalPages,
                  })}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={historySafePage >= historyTotalPages - 1}
                  onClick={() =>
                    setHistoryPage((p) => Math.min(historyTotalPages - 1, p + 1))
                  }
                >
                  {t('trades.historyNext')}
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  )
}
