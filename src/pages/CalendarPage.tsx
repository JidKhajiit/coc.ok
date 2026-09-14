import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { PublicAppShell } from '../components/PublicAppShell'
import { useI18n } from '../i18n'
import * as api from '../api/client'
import type { SiteEventScheduleEntry } from '../api/client'
import {
  inclusiveDayCount,
  phaseForEventDay,
  type EventPhase,
} from '../lib/calendarPhases'
import '../App.css'

const FALLBACK_COLORS = ['#3b6ea5', '#c9a227', '#a84b5b', '#2f7a55', '#6b5b95', '#5c6b75']

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toIsoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isoFromDate(date: Date): string {
  return toIsoDate(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  const day = next.getDate()
  next.setMonth(next.getMonth() + months)
  // Clamp overflow (e.g. Jan 31 + 1 month → Mar 3 in some engines); keep last valid day.
  if (next.getDate() < day) {
    next.setDate(0)
  }
  return next
}

function getTodayIso(): string {
  return isoFromDate(new Date())
}

/** Monday of the week containing `date`. */
function startOfWeekMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = dateFromIso(fromIso)
  const b = dateFromIso(toIso)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function eventName(entry: SiteEventScheduleEntry, isRu: boolean): string {
  return isRu ? entry.event.nameRu : entry.event.nameEn
}

function eventColor(entry: SiteEventScheduleEntry, index: number): string {
  return entry.event.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

function dayOrdinalLabel(n: number, isRu: boolean): string {
  if (isRu) return `${n} день`
  if (n === 1) return '1st day'
  if (n === 2) return '2nd day'
  if (n === 3) return '3rd day'
  return `${n}th day`
}

function phaseLabel(phase: EventPhase, t: (key: string) => string): string {
  if (phase === 'registration') return t('calendar.phase.registration')
  if (phase === 'rewards') return t('calendar.phase.rewards')
  return t('calendar.phase.active')
}

type WeekDay = {
  iso: string
  dayNum: number
  monthShort: string
  weekdayShort: string
  inRange: boolean
}

type WeekBlock = {
  key: string
  days: WeekDay[]
}

type TimelineBar = {
  entry: SiteEventScheduleEntry
  color: string
  lane: number
  /** 1-based grid column start (inclusive) */
  colStart: number
  /** 1-based grid column end (exclusive) */
  colEnd: number
  /** Day-of-event number + phase for each visible column */
  segments: Array<{ dayNumber: number; phase: EventPhase }>
}

/** Fixed window: yesterday … yesterday + 1 calendar month. */
function getVisibleRange(now = new Date()): { from: string; to: string } {
  const yesterday = addDays(now, -1)
  yesterday.setHours(0, 0, 0, 0)
  const end = addMonths(yesterday, 1)
  return { from: isoFromDate(yesterday), to: isoFromDate(end) }
}

function buildWeeksForRange(fromIso: string, toIso: string, isRu: boolean): WeekBlock[] {
  const locale = isRu ? 'ru-RU' : 'en-US'
  const firstMonday = startOfWeekMonday(dateFromIso(fromIso))
  const lastMonday = startOfWeekMonday(dateFromIso(toIso))
  const weekCount = Math.floor(daysBetween(isoFromDate(firstMonday), isoFromDate(lastMonday)) / 7) + 1
  const weeks: WeekBlock[] = []

  for (let w = 0; w < weekCount; w++) {
    const weekStart = addDays(firstMonday, w * 7)
    const days: WeekDay[] = []
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i)
      const iso = isoFromDate(date)
      days.push({
        iso,
        dayNum: date.getDate(),
        monthShort: date.toLocaleDateString(locale, { month: 'short' }),
        weekdayShort: date
          .toLocaleDateString(locale, { weekday: 'short' })
          .replace('.', '')
          .toUpperCase(),
        inRange: iso >= fromIso && iso <= toIso,
      })
    }
    weeks.push({ key: days[0].iso, days })
  }

  return weeks
}

function packBarsForWeek(
  week: WeekBlock,
  entries: SiteEventScheduleEntry[],
  colorIndexById: Map<string, number>,
  rangeFrom: string,
  rangeTo: string,
): TimelineBar[] {
  const weekFrom = week.days[0].iso
  const weekTo = week.days[6].iso
  const clipFrom = weekFrom < rangeFrom ? rangeFrom : weekFrom
  const clipTo = weekTo > rangeTo ? rangeTo : weekTo

  const overlapping = entries
    .filter((entry) => entry.startDate <= clipTo && entry.endDate >= clipFrom)
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        a.endDate.localeCompare(b.endDate) ||
        a.id.localeCompare(b.id),
    )

  const laneEnds: string[] = []
  const bars: TimelineBar[] = []

  for (const entry of overlapping) {
    const clippedStart =
      entry.startDate < clipFrom ? clipFrom : entry.startDate
    const clippedEnd = entry.endDate > clipTo ? clipTo : entry.endDate
    if (clippedStart > clippedEnd) continue

    const colStart = daysBetween(weekFrom, clippedStart) + 1
    const colEnd = daysBetween(weekFrom, clippedEnd) + 2
    const span = colEnd - colStart

    let lane = laneEnds.findIndex((endIso) => clippedStart > endIso)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(clippedEnd)
    } else {
      laneEnds[lane] = clippedEnd
    }

    const eventDayOffset = daysBetween(entry.startDate, clippedStart)
    const totalDays = inclusiveDayCount(entry.startDate, entry.endDate)
    const segments = Array.from({ length: span }, (_, i) => {
      const dayNumber = eventDayOffset + i + 1
      return {
        dayNumber,
        phase: phaseForEventDay(
          dayNumber,
          totalDays,
          entry.registrationDays,
          entry.rewardDays,
        ),
      }
    })
    const colorIdx = colorIndexById.get(entry.id) ?? 0

    bars.push({
      entry,
      color: eventColor(entry, colorIdx),
      lane: lane + 1,
      colStart,
      colEnd,
      segments,
    })
  }

  return bars
}

function CalendarContent() {
  const { t, locale } = useI18n()
  const isRu = locale === 'ru'
  const todayIso = useMemo(() => getTodayIso(), [])
  const range = useMemo(() => getVisibleRange(), [])

  const [entries, setEntries] = useState<SiteEventScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void api
      .listCalendarSchedule(range)
      .then((rows) => {
        if (!cancelled) setEntries(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setEntries([])
          setError(err instanceof Error ? err.message : t('calendar.loadError'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range, t])

  const weeks = useMemo(
    () => buildWeeksForRange(range.from, range.to, isRu),
    [range, isRu],
  )

  const colorIndexById = useMemo(() => {
    const map = new Map<string, number>()
    entries.forEach((entry, index) => map.set(entry.id, index))
    return map
  }, [entries])

  return (
    <div className="app app--calendar">
      <div className="atmosphere" aria-hidden />

      <header className="calendar-hero">
        <h1 className="calendar-hero__title">{t('calendar.title')}</h1>
        <p className="calendar-hero__lead">{t('calendar.lead')}</p>
      </header>

      <section className="calendar-timeline" aria-label={t('calendar.title')}>
        {loading ? (
          <p className="calendar-status">{t('calendar.loading')}</p>
        ) : error ? (
          <p className="calendar-status calendar-status--error">{error}</p>
        ) : (
          <div className="calendar-timeline__weeks">
            {weeks.map((week) => {
              const bars = packBarsForWeek(
                week,
                entries,
                colorIndexById,
                range.from,
                range.to,
              )
              const laneCount = bars.reduce((max, bar) => Math.max(max, bar.lane), 0)
              const hasInRangeDays = week.days.some((day) => day.inRange)

              return (
                <div key={week.key} className="tl-week">
                  <div className="tl-days" role="row">
                    {week.days.map((day) => {
                      const isToday = day.iso === todayIso
                      return (
                        <div
                          key={day.iso}
                          className={`tl-day${isToday ? ' is-today' : ''}${day.inRange ? '' : ' is-out'}`}
                          role="columnheader"
                        >
                          <span className="tl-day__date">
                            {day.dayNum} {day.monthShort}
                          </span>
                          <span className="tl-day__weekday">{day.weekdayShort}</span>
                        </div>
                      )
                    })}
                  </div>

                  {!hasInRangeDays ? null : laneCount === 0 ? (
                    <p className="tl-week__empty">{t('calendar.weekEmpty')}</p>
                  ) : (
                    <div
                      className="tl-lanes"
                      style={{
                        gridTemplateRows: `repeat(${laneCount}, minmax(58px, auto))`,
                      }}
                    >
                      {bars.map((bar) => {
                        const name = eventName(bar.entry, isRu)
                        const content = (
                          <>
                            <div
                              className="tl-bar__head"
                              style={{ backgroundColor: bar.color }}
                            >
                              {name}
                            </div>
                            <div className="tl-bar__body">
                              {bar.segments.map((seg) => (
                                <div
                                  key={`${bar.entry.id}-${seg.dayNumber}`}
                                  className={`tl-bar__seg tl-bar__seg--${seg.phase}`}
                                >
                                  <span className="tl-bar__daynum">
                                    {dayOrdinalLabel(seg.dayNumber, isRu)}
                                  </span>
                                  <span className="tl-bar__phase">
                                    {phaseLabel(seg.phase, t)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )

                        return (
                          <div
                            key={`${week.key}-${bar.entry.id}`}
                            className="tl-bar"
                            style={
                              {
                                gridColumn: `${bar.colStart} / ${bar.colEnd}`,
                                gridRow: bar.lane,
                                ['--tl-color' as string]: bar.color,
                              } as CSSProperties
                            }
                          >
                            {bar.entry.event.path ? (
                              <Link
                                to={bar.entry.event.path}
                                className="tl-bar__link"
                                title={name}
                              >
                                {content}
                              </Link>
                            ) : (
                              <div className="tl-bar__link" title={name}>
                                {content}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

export function CalendarPage() {
  return (
    <PublicAppShell showCollectionNav={false}>
      <CalendarContent />
    </PublicAppShell>
  )
}
