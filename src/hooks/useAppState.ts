import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { migrateState, isEmptyState } from '../../shared/migrateState'
import { EMPTY_STATE } from '../../shared/types'
import type { Card } from '../types'
import type {
  Account,
  AppState,
  PotentialTrade,
  TradeRecord,
  TradeSource,
  TrendItem,
} from '../types'
import { SOLO_ACCOUNT_ID } from '../types'
import { normalizeLocale, type Locale } from '../i18n'
import { isSameGameDay } from '../utils/gameDay'
import * as api from '../api/client'

const TRADE_SOURCES: TradeSource[] = ['completed', 'observed', 'cancelled']

function normalizeTradeSource(source: unknown): TradeSource {
  return TRADE_SOURCES.includes(source as TradeSource)
    ? (source as TradeSource)
    : 'completed'
}

const LEGACY_STORAGE_KEY = 'coc-card-trades-v1'
const SAVE_DEBOUNCE_MS = 500

function loadLegacyLocalStorage(eventSlug: string): AppState | null {
  if (eventSlug !== 'summer-party') return null
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AppState> & { wishlist?: string[] }
    return migrateState(parsed)
  } catch {
    return null
  }
}

function clearLegacyLocalStorage(eventSlug: string) {
  if (eventSlug !== 'summer-party') return
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // ignore
  }
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function useAppState(eventSlug: string, cards: Card[]) {
  const [state, setState] = useState<AppState>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState(true)
  const skipSaveRef = useRef(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadFromServer() {
      setLoading(true)
      setSaveError(null)
      try {
        let data = await api.getEventState(eventSlug)

        const legacy = loadLegacyLocalStorage(eventSlug)
        if (legacy && isEmptyState(data) && !isEmptyState(legacy)) {
          data = await api.putEventState(eventSlug, legacy)
          clearLegacyLocalStorage(eventSlug)
        }

        if (!cancelled) {
          setState(data)
          skipSaveRef.current = true
          setLastSaved(true)
        }
      } catch (err) {
        if (!cancelled) {
          setSaveError(err instanceof Error ? err.message : 'Failed to load data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadFromServer()
    return () => {
      cancelled = true
    }
  }, [eventSlug])

  useEffect(() => {
    if (loading) return
    if (skipSaveRef.current) {
      skipSaveRef.current = false
      return
    }

    setLastSaved(false)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(() => {
      setSaving(true)
      const snapshot = state
      void api
        .putEventState(eventSlug, snapshot)
        .then((saved) => {
          setState((current) => {
            // Ignore stale responses if the user edited while the request was in flight.
            if (current !== snapshot) return current
            skipSaveRef.current = true
            return saved
          })
          setLastSaved(true)
          setSaveError(null)
        })
        .catch((err) => {
          setSaveError(err instanceof Error ? err.message : 'Failed to save data')
        })
        .finally(() => {
          setSaving(false)
        })
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [state, loading, eventSlug])

  const reservedByCard = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of state.potentialTrades) {
      map[t.givenCardId] = (map[t.givenCardId] ?? 0) + 1
    }
    return map
  }, [state.potentialTrades])

  const reservedPartners = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const t of state.potentialTrades) {
      if (!t.partner?.trim()) continue
      const list = map[t.givenCardId] ?? []
      list.push(t.partner)
      map[t.givenCardId] = list
    }
    return map
  }, [state.potentialTrades])

  const setOwned = useCallback((cardId: string, qty: number) => {
    setState((prev) => {
      const next = { ...prev.owned }
      if (qty <= 0) delete next[cardId]
      else next[cardId] = qty
      return { ...prev, owned: next }
    })
  }, [])

  const adjustOwned = useCallback((cardId: string, delta: number) => {
    setState((prev) => {
      const current = prev.owned[cardId] ?? 0
      const qty = Math.max(0, current + delta)
      const next = { ...prev.owned }
      if (qty <= 0) delete next[cardId]
      else next[cardId] = qty
      return { ...prev, owned: next }
    })
  }, [])

  const setLocale = useCallback((locale: Locale) => {
    setState((prev) => ({ ...prev, locale: normalizeLocale(locale) }))
  }, [])

  const toggleNeeded = useCallback((cardId: string, accountId: string) => {
    setState((prev) => {
      const current = prev.neededBy[cardId] ?? []
      const has = current.includes(accountId)
      const nextList = has
        ? current.filter((id) => id !== accountId)
        : [...current, accountId]
      const neededBy = { ...prev.neededBy }
      if (nextList.length === 0) delete neededBy[cardId]
      else neededBy[cardId] = nextList
      return { ...prev, neededBy }
    })
  }, [])

  const setNeededForAll = useCallback((cardId: string, needed: boolean) => {
    setState((prev) => {
      const neededBy = { ...prev.neededBy }
      if (needed) {
        neededBy[cardId] =
          prev.accounts.length > 0
            ? prev.accounts.map((a) => a.id)
            : [SOLO_ACCOUNT_ID]
      } else delete neededBy[cardId]
      return { ...prev, neededBy }
    })
  }, [])

  const toggleStar = useCallback((cardId: string) => {
    setState((prev) => {
      const current = prev.neededBy[cardId] ?? []
      const neededBy = { ...prev.neededBy }
      const isOn = current.length > 0
      if (isOn) {
        delete neededBy[cardId]
      } else if (prev.accounts.length === 0) {
        neededBy[cardId] = [SOLO_ACCOUNT_ID]
      } else if (prev.accounts.length === 1) {
        neededBy[cardId] = [prev.accounts[0]!.id]
      } else {
        neededBy[cardId] = prev.accounts.map((a) => a.id)
      }
      return { ...prev, neededBy }
    })
  }, [])

  const renameAccount = useCallback((accountId: string, name: string) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === accountId ? { ...a, name } : a,
      ),
    }))
  }, [])

  const addAccount = useCallback((name?: string) => {
    setState((prev) => {
      const n = prev.accounts.length + 1
      const account: Account = {
        id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        name: (name ?? `Акк ${n}`).trim() || `Акк ${n}`,
      }
      // solo-метки → новый единственный/первый аккаунт
      let neededBy = prev.neededBy
      if (prev.accounts.length === 0) {
        neededBy = {}
        for (const [cardId, ids] of Object.entries(prev.neededBy)) {
          if (ids.includes(SOLO_ACCOUNT_ID) || ids.length > 0) {
            neededBy[cardId] = [account.id]
          }
        }
      }
      return { ...prev, accounts: [...prev.accounts, account], neededBy }
    })
  }, [])

  const removeAccount = useCallback((accountId: string) => {
    setState((prev) => {
      const accounts = prev.accounts.filter((a) => a.id !== accountId)
      const neededBy: Record<string, string[]> = {}
      for (const [cardId, ids] of Object.entries(prev.neededBy)) {
        const next = ids.filter((id) => id !== accountId)
        if (accounts.length === 0) {
          if (next.length > 0 || ids.length > 0) neededBy[cardId] = [SOLO_ACCOUNT_ID]
        } else if (next.length) {
          neededBy[cardId] = next
        }
      }
      return { ...prev, accounts, neededBy }
    })
  }, [])

  const setAccounts = useCallback((accounts: Account[]) => {
    setState((prev) => {
      const ids = new Set(accounts.map((a) => a.id))
      const neededBy: Record<string, string[]> = {}
      for (const [cardId, list] of Object.entries(prev.neededBy)) {
        if (accounts.length === 0) {
          if (list.length) neededBy[cardId] = [SOLO_ACCOUNT_ID]
          continue
        }
        const next = list.filter((id) => ids.has(id))
        if (next.length) neededBy[cardId] = next
      }
      return { ...prev, accounts, neededBy }
    })
  }, [])

  const addTrade = useCallback(
    (input: Omit<TradeRecord, 'id' | 'createdAt'> & { createdAt?: string }) => {
      const receivedCardId = input.receivedCardId?.trim() || undefined
      if (receivedCardId && input.givenCardId === receivedCardId) return

      const source = normalizeTradeSource(input.source)
      const trade: TradeRecord = {
        id: uid(),
        givenCardId: input.givenCardId,
        receivedCardId,
        partner: input.partner,
        note: input.note,
        createdAt: input.createdAt ?? new Date().toISOString(),
        source,
      }

      setState((prev) => {
        if (source !== 'completed') {
          return {
            ...prev,
            trades: [trade, ...prev.trades],
          }
        }

        const owned = { ...prev.owned }
        const givenQty = owned[trade.givenCardId] ?? 0
        if (givenQty > 0) {
          if (givenQty <= 1) delete owned[trade.givenCardId]
          else owned[trade.givenCardId] = givenQty - 1
        }
        if (trade.receivedCardId) {
          owned[trade.receivedCardId] = (owned[trade.receivedCardId] ?? 0) + 1
        }

        return {
          ...prev,
          owned,
          trades: [trade, ...prev.trades],
        }
      })
    },
    [],
  )

  const removeTrade = useCallback((tradeId: string) => {
    setState((prev) => ({
      ...prev,
      trades: prev.trades.filter((t) => t.id !== tradeId),
    }))
  }, [])

  const addPotentialTrade = useCallback(
    (input: Omit<PotentialTrade, 'id' | 'createdAt'> & { createdAt?: string }) => {
      const receivedCardId = input.receivedCardId?.trim() || undefined
      if (receivedCardId && input.givenCardId === receivedCardId) return false

      const trade: PotentialTrade = {
        id: uid(),
        givenCardId: input.givenCardId,
        receivedCardId,
        partner: input.partner?.trim() || undefined,
        note: input.note?.trim() || undefined,
        createdAt: input.createdAt ?? new Date().toISOString(),
      }
      setState((prev) => ({
        ...prev,
        potentialTrades: [trade, ...prev.potentialTrades],
      }))
      return true
    },
    [],
  )

  const updatePotentialTrade = useCallback(
    (
      id: string,
      input: {
        givenCardId: string
        receivedCardId?: string
        partner?: string
        note?: string
      },
    ) => {
      const receivedCardId = input.receivedCardId?.trim() || undefined
      if (receivedCardId && input.givenCardId === receivedCardId) return false

      let ok = false
      setState((prev) => {
        if (!prev.potentialTrades.some((t) => t.id === id)) return prev
        ok = true
        return {
          ...prev,
          potentialTrades: prev.potentialTrades.map((t) =>
            t.id === id
              ? {
                  ...t,
                  givenCardId: input.givenCardId,
                  receivedCardId,
                  partner: input.partner?.trim() || undefined,
                  note: input.note?.trim() || undefined,
                }
              : t,
          ),
        }
      })
      return ok
    },
    [],
  )

  const removePotentialTrade = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      potentialTrades: prev.potentialTrades.filter((t) => t.id !== id),
    }))
  }, [])

  const confirmPotentialTrade = useCallback((id: string) => {
    setState((prev) => {
      const potential = prev.potentialTrades.find((t) => t.id === id)
      if (!potential) return prev

      const owned = { ...prev.owned }
      const givenQty = owned[potential.givenCardId] ?? 0
      if (givenQty > 0) {
        if (givenQty <= 1) delete owned[potential.givenCardId]
        else owned[potential.givenCardId] = givenQty - 1
      }
      if (potential.receivedCardId) {
        owned[potential.receivedCardId] =
          (owned[potential.receivedCardId] ?? 0) + 1
      }

      const trade: TradeRecord = {
        id: uid(),
        givenCardId: potential.givenCardId,
        receivedCardId: potential.receivedCardId,
        partner: potential.partner,
        note: potential.note,
        createdAt: new Date().toISOString(),
        source: 'completed',
      }

      return {
        ...prev,
        owned,
        potentialTrades: prev.potentialTrades.filter((t) => t.id !== id),
        trades: [trade, ...prev.trades],
      }
    })
  }, [])

  const archivePotentialTrade = useCallback((id: string) => {
    setState((prev) => {
      const potential = prev.potentialTrades.find((t) => t.id === id)
      if (!potential) return prev

      const trade: TradeRecord = {
        id: uid(),
        givenCardId: potential.givenCardId,
        receivedCardId: potential.receivedCardId,
        partner: potential.partner,
        note: potential.note,
        createdAt: new Date().toISOString(),
        source: 'cancelled',
      }

      return {
        ...prev,
        potentialTrades: prev.potentialTrades.filter((t) => t.id !== id),
        trades: [trade, ...prev.trades],
      }
    })
  }, [])

  const duplicates = useMemo(() => {
    return Object.entries(state.owned)
      .filter(([, qty]) => qty > 1)
      .map(([cardId, qty]) => {
        const reserved = reservedByCard[cardId] ?? 0
        return {
          cardId,
          qty,
          reserved,
          tradeable: Math.max(0, qty - 1 - reserved),
        }
      })
  }, [state.owned, reservedByCard])

  /** Отдаваемые в потенциале без копии для обмена (qty ≤ 1) */
  const tradeNeedCardIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of state.potentialTrades) {
      if ((state.owned[t.givenCardId] ?? 0) <= 1) ids.add(t.givenCardId)
    }
    return ids
  }, [state.potentialTrades, state.owned])

  /** Карты с qty=0, ♥, или нужные под потенциальный обмен */
  const neededCards = useMemo(() => {
    const ids = new Set<string>()
    for (const c of cards) {
      if ((state.owned[c.id] ?? 0) === 0) ids.add(c.id)
    }
    for (const id of Object.keys(state.neededBy)) {
      if ((state.neededBy[id] ?? []).length > 0) ids.add(id)
    }
    for (const id of tradeNeedCardIds) ids.add(id)
    return [...ids]
      .map((id) => cards.find((c) => c.id === id)!)
      .filter(Boolean)
      .sort((a, b) => a.number - b.number)
  }, [state.owned, state.neededBy, tradeNeedCardIds, cards])

  const trends = useMemo(() => {
    const given: Record<string, number> = {}
    const requested: Record<string, number> = {}

    for (const t of state.trades) {
      given[t.givenCardId] = (given[t.givenCardId] ?? 0) + 1
      if (t.receivedCardId) {
        requested[t.receivedCardId] = (requested[t.receivedCardId] ?? 0) + 1
      }
    }

    const toList = (map: Record<string, number>): TrendItem[] =>
      Object.entries(map)
        .map(([cardId, count]) => ({ cardId, count }))
        .sort((a, b) => b.count - a.count)

    return {
      mostGiven: toList(given),
      mostRequested: toList(requested),
    }
  }, [state.trades])

  const stats = useMemo(() => {
    const ownedIds = Object.keys(state.owned).filter((id) => (state.owned[id] ?? 0) > 0)
    const totalCopies = Object.values(state.owned).reduce((s, n) => s + n, 0)
    const tradeable = duplicates.reduce((s, d) => s + d.tradeable, 0)
    const missingCount = cards.filter((c) => (state.owned[c.id] ?? 0) === 0).length
    let completedCount = 0
    let archiveCount = 0
    let tradesToday = 0
    for (const t of state.trades) {
      const source = normalizeTradeSource(t.source)
      if (source === 'completed') {
        completedCount += 1
        if (isSameGameDay(t.createdAt)) tradesToday += 1
      } else archiveCount += 1
    }
    return {
      uniqueOwned: ownedIds.length,
      totalCopies,
      tradeable,
      wishlistCount: neededCards.length,
      missingCount,
      tradeCount: completedCount,
      tradesToday,
      archiveCount,
      historyCount: state.trades.length,
      potentialCount: state.potentialTrades.length,
    }
  }, [
    state.owned,
    state.trades,
    state.potentialTrades.length,
    duplicates,
    neededCards.length,
    cards,
  ])

  const exportBackup = useCallback(() => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: state,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `critter-trades-backup-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [state])

  const copyBackup = useCallback(async () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: state,
    }
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
  }, [state])

  const importBackup = useCallback(async (file: File) => {
    const text = await file.text()
    const parsed = JSON.parse(text) as
      | { data?: Partial<AppState>; wishlist?: string[] }
      | Partial<AppState>
    const raw =
      parsed && typeof parsed === 'object' && 'data' in parsed && parsed.data
        ? parsed.data
        : (parsed as Partial<AppState>)
    const next = migrateState(raw as Partial<AppState> & { wishlist?: string[] })
    setState(next)
  }, [])

  const importBackupText = useCallback(async (text: string) => {
    const parsed = JSON.parse(text) as
      | { data?: Partial<AppState>; wishlist?: string[] }
      | Partial<AppState>
    const raw =
      parsed && typeof parsed === 'object' && 'data' in parsed && parsed.data
        ? parsed.data
        : (parsed as Partial<AppState>)
    const next = migrateState(raw as Partial<AppState> & { wishlist?: string[] })
    setState(next)
  }, [])

  return {
    state,
    loading,
    saving,
    saveError,
    lastSaved,
    setOwned,
    adjustOwned,
    setLocale,
    toggleNeeded,
    setNeededForAll,
    toggleStar,
    renameAccount,
    addAccount,
    removeAccount,
    setAccounts,
    addTrade,
    removeTrade,
    addPotentialTrade,
    updatePotentialTrade,
    removePotentialTrade,
    confirmPotentialTrade,
    archivePotentialTrade,
    exportBackup,
    copyBackup,
    importBackup,
    importBackupText,
    reservedByCard,
    reservedPartners,
    tradeNeedCardIds,
    duplicates,
    neededCards,
    trends,
    stats,
  }
}

export type { Account }
