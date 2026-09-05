import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Account } from '../types'
import { useI18n } from '../i18n'

interface Props {
  accounts: Account[]
  neededAccountIds: string[]
  onToggle: (accountId: string) => void
  onToggleAll?: () => void
  onToggleStar?: () => void
}

interface MenuPos {
  top: number
  left: number
}

export function AccountNeedToggles({
  accounts,
  neededAccountIds,
  onToggle,
  onToggleAll,
  onToggleStar,
}: Props) {
  const { t } = useI18n()
  const multi = accounts.length > 1
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const count = neededAccountIds.length
  const isOn = count > 0
  const allOn = accounts.length > 0 && accounts.every((a) => neededAccountIds.includes(a.id))

  useLayoutEffect(() => {
    if (!open || !multi || !btnRef.current) {
      setPos(null)
      return
    }

    function place() {
      const btn = btnRef.current
      const menu = menuRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const menuW = menu?.offsetWidth ?? 160
      const menuH = menu?.offsetHeight ?? 140
      const gap = 4
      const pad = 8

      let left = rect.right - menuW
      left = Math.max(pad, Math.min(left, window.innerWidth - menuW - pad))

      let top = rect.bottom + gap
      if (top + menuH > window.innerHeight - pad && rect.top - gap - menuH > pad) {
        top = rect.top - gap - menuH
      }

      setPos({ top, left })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, multi, accounts.length])

  useEffect(() => {
    if (!open || !multi) return

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, multi])

  if (!multi) {
    return (
      <div className="acc-needs" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`acc-needs__star ${isOn ? 'is-on' : ''}`}
          onClick={() => {
            if (onToggleStar) onToggleStar()
            else if (accounts.length === 1) onToggle(accounts[0]!.id)
            else onToggleAll?.()
          }}
          title={isOn ? t('need.remove') : t('need.add')}
          aria-pressed={isOn}
        >
          {isOn ? '♥' : '♡'}
        </button>
      </div>
    )
  }

  const menu = open
    ? createPortal(
        <div
          className="acc-needs__menu"
          id={menuId}
          role="menu"
          ref={menuRef}
          style={
            pos
              ? { top: pos.top, left: pos.left, visibility: 'visible' }
              : { top: 0, left: 0, visibility: 'hidden' }
          }
          onClick={(e) => e.stopPropagation()}
        >
          {accounts.map((a) => {
            const on = neededAccountIds.includes(a.id)
            return (
              <label
                key={a.id}
                className="acc-needs__option"
                role="menuitemcheckbox"
                aria-checked={on}
              >
                <input type="checkbox" checked={on} onChange={() => onToggle(a.id)} />
                <span>{a.name}</span>
              </label>
            )
          })}
          {onToggleAll && (
            <>
              <div className="acc-needs__sep" />
              <button
                type="button"
                className="acc-needs__all"
                role="menuitem"
                onClick={() => onToggleAll()}
              >
                {allOn ? t('need.clearAll') : t('need.all')}
              </button>
            </>
          )}
        </div>,
        document.body,
      )
    : null

  return (
    <div className={`acc-needs ${open ? 'is-open' : ''}`} onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        className={`acc-needs__star ${isOn ? 'is-on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        title={
          isOn
            ? t('need.needed', {
                names: accounts
                  .filter((a) => neededAccountIds.includes(a.id))
                  .map((a) => a.name)
                  .join(', '),
              })
            : t('need.markAccounts')
        }
      >
        {isOn ? '♥' : '♡'}
        {count > 0 && <span className="acc-needs__count">{count}</span>}
      </button>
      {menu}
    </div>
  )
}
