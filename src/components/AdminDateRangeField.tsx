import { useEffect, useMemo, useState } from 'react'

type Props = {
  startDate: string
  endDate: string
  onChange: (startDate: string, endDate: string) => void
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function toIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatRu(iso: string): string {
  return parseIso(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function monthCells(year: number, monthIndex: number): Array<{ iso: string; day: number }> {
  const first = new Date(year, monthIndex, 1)
  const offset = (first.getDay() + 6) % 7
  const gridStart = new Date(year, monthIndex, 1 - offset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return { iso: toIso(date), day: date.getDate() }
  })
}

function rangeBounds(start: string, end: string): { from: string; to: string } | null {
  if (!start || !end) return null
  return start <= end ? { from: start, to: end } : { from: end, to: start }
}

export function AdminDateRangeField({ startDate, endDate, onChange }: Props) {
  const [view, setView] = useState(() => {
    const base = startDate ? parseIso(startDate) : new Date()
    return { year: base.getFullYear(), month: base.getMonth() }
  })
  const [anchor, setAnchor] = useState<string | null>(null)
  const [hoverIso, setHoverIso] = useState<string | null>(null)

  useEffect(() => {
    if (!startDate && !endDate) setAnchor(null)
  }, [startDate, endDate])

  useEffect(() => {
    if (!startDate) return
    const base = parseIso(startDate)
    setView({ year: base.getFullYear(), month: base.getMonth() })
  }, [startDate])

  const cells = useMemo(() => monthCells(view.year, view.month), [view.year, view.month])
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  })

  const previewEnd = anchor ? hoverIso : endDate
  const bounds = anchor && previewEnd
    ? rangeBounds(anchor, previewEnd)
    : rangeBounds(startDate, endDate)

  const shiftMonth = (delta: number) => {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  const pickDay = (iso: string) => {
    if (!anchor) {
      setAnchor(iso)
      onChange(iso, '')
      return
    }
    const next = rangeBounds(anchor, iso)
    setAnchor(null)
    setHoverIso(null)
    if (next) onChange(next.from, next.to)
  }

  const summary = anchor
    ? `с ${formatRu(anchor)} по …`
    : startDate && endDate
      ? `с ${formatRu(startDate)} по ${formatRu(endDate)}`
      : 'Нажмите первый день, затем последний'

  return (
    <div className="admin-range">
      <p className="admin-range__summary">{summary}</p>
      <div className="admin-range__nav">
        <button type="button" className="admin-range__nav-btn" onClick={() => shiftMonth(-1)}>
          ‹
        </button>
        <span className="admin-range__month">{monthLabel}</span>
        <button type="button" className="admin-range__nav-btn" onClick={() => shiftMonth(1)}>
          ›
        </button>
      </div>
      <div className="admin-range__weekdays" aria-hidden>
        {WEEKDAYS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="admin-range__grid" role="grid" aria-label="Диапазон дней ивента">
        {cells.map((cell) => {
          const inMonth = cell.iso.startsWith(
            `${view.year}-${String(view.month + 1).padStart(2, '0')}`,
          )
          const edgeStart = anchor ?? startDate
          const edgeEnd = anchor ? '' : endDate
          const isStart = cell.iso === edgeStart
          const isEnd = Boolean(edgeEnd) && cell.iso === edgeEnd
          const inSpan = Boolean(bounds && cell.iso >= bounds.from && cell.iso <= bounds.to)
          const className = [
            'admin-range__day',
            inMonth ? '' : 'is-out',
            inSpan ? 'is-in' : '',
            isStart ? 'is-start' : '',
            isEnd ? 'is-end' : '',
            isStart && isEnd ? 'is-single' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={cell.iso}
              type="button"
              className={className}
              onClick={() => pickDay(cell.iso)}
              onMouseEnter={() => setHoverIso(cell.iso)}
              onMouseLeave={() => setHoverIso(null)}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
