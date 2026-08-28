import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Card } from '../types'
import { useI18n } from '../i18n'

interface Props {
  value: string
  onChange: (cardId: string) => void
  cards: Card[]
  formatOption: (card: Card) => string
  placeholder?: string
  required?: boolean
}

function matchesQuery(card: Card, q: string): boolean {
  if (!q) return true
  return (
    card.name.toLowerCase().includes(q) ||
    card.setName.toLowerCase().includes(q) ||
    String(card.number).includes(q)
  )
}

export function CardPicker({
  value,
  onChange,
  cards,
  formatOption,
  placeholder,
  required,
}: Props) {
  const { t } = useI18n()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = value ? cards.find((c) => c.id === value) : undefined

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cards.filter((c) => matchesQuery(c, q))
  }, [cards, query])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function pick(card: Card) {
    onChange(card.id)
    setQuery('')
    setOpen(false)
  }

  function onFocus() {
    setOpen(true)
    if (selected) setQuery('')
  }

  const inputValue = open ? query : selected ? formatOption(selected) : query

  return (
    <div
      ref={rootRef}
      className={`card-picker ${open ? 'is-open' : ''} ${value ? 'has-value' : ''}`}
    >
      <input
        className="input card-picker__input"
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-required={required || undefined}
        placeholder={placeholder ?? t('collection.search')}
        value={inputValue}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (value) onChange('')
        }}
        onFocus={onFocus}
      />
      {inputValue.length > 0 && (
        <button
          type="button"
          className="card-picker__clear"
          onClick={() => {
            setQuery('')
            onChange('')
            setOpen(true)
          }}
          aria-label={t('common.clearSearch')}
        >
          ×
        </button>
      )}
      {open && (
        <ul className="card-picker__list" id={listId} role="listbox">
          {filtered.length === 0 ? (
            <li className="card-picker__empty">{t('cardPicker.empty')}</li>
          ) : (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`card-picker__option ${c.id === value ? 'is-selected' : ''}`}
                  role="option"
                  aria-selected={c.id === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c)}
                >
                  {formatOption(c)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
