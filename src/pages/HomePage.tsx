import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { I18nProvider } from '../i18n'
import { usePersistedLocale } from '../hooks/usePersistedLocale'
import { PublicChrome } from '../components/PublicChrome'
import { SiteFooter } from '../components/SiteFooter'
import { BRAND_NAME } from '../brand'
import * as api from '../api/client'
import '../App.css'

type Localized = { ru: string; en: string }

type SiteEvent = {
  id: string
  name: Localized
  /** ISO date YYYY-MM-DD */
  start?: string
  /** ISO date YYYY-MM-DD */
  end: string
  path?: string
}

/** События вне card-trades, которые пока не приходят из API */
const STATIC_EVENTS: SiteEvent[] = [
  {
    id: 'gold-rush-sea-ruffians',
    name: {
      ru: 'Турнир Золотой лихорадки: Морские грубины',
      en: 'Gold Rush Tournament: Sea Ruffians',
    },
    start: '2026-09-03',
    end: '2026-09-08',
  },
  {
    id: 'fishing-race',
    name: { ru: 'Рыбацкая гонка', en: 'Fishing Race' },
    start: '2026-09-06',
    end: '2026-09-08',
  },
  {
    id: 'cozy-farm',
    name: { ru: 'Уютная ферма', en: 'Cozy Farm' },
    start: '2026-09-03',
    end: '2026-09-05',
    path: '/cozy-farm',
  },
]

type Resource = {
  id: string
  icon: string
  title: Localized
  desc: Localized
  path: string
  badge?: Localized
  disabled?: boolean
}

const RESOURCES: Resource[] = [
  {
    id: 'card-trades',
    icon: '🃏',
    title: { ru: 'Трекер обменов', en: 'Card Trades Tracker' },
    desc: {
      ru: 'Коллекция, вишлист и история обменов для карточных эвентов.',
      en: 'Collection, wishlist and trade history for card events.',
    },
    path: '/card-trades',
  },
  {
    id: 'guides',
    icon: '📖',
    title: { ru: 'Гайды', en: 'Guides' },
    desc: {
      ru: 'Руководства для новичков и продвинутые стратегии.',
      en: 'Beginner guides and advanced strategies.',
    },
    path: '/guides',
    badge: { ru: 'скоро', en: 'soon' },
    disabled: true,
  },
  {
    id: 'database',
    icon: '🐾',
    title: { ru: 'База Татари', en: 'Tatari Database' },
    desc: {
      ru: 'Характеристики, эволюции и способности всех существ.',
      en: 'Stats, evolutions and abilities for all critters.',
    },
    path: '/database',
    badge: { ru: 'скоро', en: 'soon' },
    disabled: true,
  },
  {
    id: 'tier-list',
    icon: '📊',
    title: { ru: 'Тир-лист', en: 'Tier List' },
    desc: {
      ru: 'Рейтинг Татари для разных режимов игры.',
      en: 'Tatari rankings for different game modes.',
    },
    path: '/tier-list',
    badge: { ru: 'скоро', en: 'soon' },
    disabled: true,
  },
]

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getTodayIso(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(iso: string, isRu: boolean): string {
  const date = parseIsoDate(iso)
  return date.toLocaleDateString(isRu ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatEventDates(event: SiteEvent, isRu: boolean): string {
  if (event.start) {
    return `${formatDate(event.start, isRu)} – ${formatDate(event.end, isRu)}`
  }
  return isRu
    ? `до ${formatDate(event.end, isRu)}`
    : `until ${formatDate(event.end, isRu)}`
}

function daysUntil(iso: string): number {
  const target = parseIsoDate(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000))
}

function isCurrentEvent(event: SiteEvent, todayIso: string): boolean {
  if (event.start) {
    return event.start <= todayIso && todayIso <= event.end
  }
  return todayIso <= event.end
}

function isUpcomingEvent(event: SiteEvent, todayIso: string): boolean {
  return Boolean(event.start && todayIso < event.start)
}

function EventList({
  events,
  isRu,
  emptyLabel,
  mode,
}: {
  events: SiteEvent[]
  isRu: boolean
  emptyLabel: string
  mode: 'current' | 'upcoming'
}) {
  if (events.length === 0) {
    return <p className="home-events-list__empty">{emptyLabel}</p>
  }

  return (
    <ul className="home-events-list">
      {events.map((event) => {
        const countdownIso =
          mode === 'upcoming' ? (event.start ?? event.end) : event.end
        const days = daysUntil(countdownIso)
        const title = isRu ? event.name.ru : event.name.en
        const relative =
          days > 0
            ? mode === 'upcoming'
              ? isRu
                ? ` · через ${days} ${daysRu(days)}`
                : ` · in ${days} day${days === 1 ? '' : 's'}`
              : isRu
                ? ` · ещё ${days} ${daysRu(days)}`
                : ` · ${days} day${days === 1 ? '' : 's'} left`
            : null
        const content = (
          <>
            <span className="home-events-list__name">{title}</span>
            <span className="home-events-list__dates">
              {formatEventDates(event, isRu)}
              {relative && <span className="home-events-list__left">{relative}</span>}
            </span>
          </>
        )

        return (
          <li key={event.id} className="home-events-list__item">
            {event.path ? (
              <Link to={event.path} className="home-events-list__link">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        )
      })}
    </ul>
  )
}

function daysRu(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня'
  return 'дней'
}

function HomeContent() {
  const { locale, setLocale } = usePersistedLocale()
  const isRu = locale === 'ru'
  const [cardTradeEvents, setCardTradeEvents] = useState<SiteEvent[]>([])
  const [todayIso, setTodayIso] = useState(() => getTodayIso())

  useEffect(() => {
    let cancelled = false
    void api
      .listCardTradeEvents()
      .then((events) => {
        if (cancelled) return
        setCardTradeEvents(
          events
            .map((event) => ({
              id: event.slug,
              name: { ru: event.name, en: event.name },
              start: event.startDate,
              end: event.endDate,
              path: `/${event.slug}`,
            })),
        )
      })
      .catch(() => {
        if (!cancelled) setCardTradeEvents([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const now = new Date()
    const nextMidnight = new Date(now)
    nextMidnight.setHours(24, 0, 5, 0)

    const timeoutMs = Math.max(1_000, nextMidnight.getTime() - now.getTime())
    const timer = window.setTimeout(() => {
      setTodayIso(getTodayIso())
    }, timeoutMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [todayIso])

  const allEvents = useMemo(() => [...STATIC_EVENTS, ...cardTradeEvents], [cardTradeEvents])
  const currentEvents = useMemo(
    () =>
      allEvents
        .filter((event) => isCurrentEvent(event, todayIso))
        .sort((a, b) => a.end.localeCompare(b.end) || (a.start ?? a.end).localeCompare(b.start ?? b.end)),
    [allEvents, todayIso],
  )
  const upcomingEvents = useMemo(
    () =>
      allEvents
        .filter((event) => isUpcomingEvent(event, todayIso))
        .sort((a, b) => (a.start ?? a.end).localeCompare(b.start ?? b.end) || a.end.localeCompare(b.end)),
    [allEvents, todayIso],
  )

  return (
    <I18nProvider locale={locale} setLocale={setLocale}>
      <PublicChrome locale={locale} onLocaleChange={setLocale} showCollectionNav={false} />

      <div className="app app--home">
        <div className="atmosphere" aria-hidden />

        <header className="home-hero">
          <h1 className="home-hero__brand">{BRAND_NAME}</h1>
          <p className="home-hero__tagline">
            {isRu
              ? 'Гайды, тир-листы и трекеры для Clash of Critters'
              : 'Guides, tier lists & trackers for Clash of Critters'}
          </p>
        </header>

        <section className="home-intro">
          <p>
            {isRu
              ? 'Всё, что нужно для прокачки ваших Татари: от базовых гайдов до продвинутых стратегий и инструментов отслеживания.'
              : 'Everything you need to level up your Tatari: from beginner guides to advanced strategies and tracking tools.'}
          </p>
        </section>

        <section className="home-schedule">
          <div className="home-schedule__col">
            <h2>{isRu ? 'Текущие события' : 'Current Events'}</h2>
            <EventList
              events={currentEvents}
              isRu={isRu}
              mode="current"
              emptyLabel={isRu ? 'Сейчас нет активных событий' : 'No active events right now'}
            />
          </div>
          <div className="home-schedule__col">
            <h2>{isRu ? 'Предстоящие события' : 'Upcoming Events'}</h2>
            <EventList
              events={upcomingEvents}
              isRu={isRu}
              mode="upcoming"
              emptyLabel={isRu ? 'Пока нет анонсов' : 'No announcements yet'}
            />
          </div>
        </section>

        <section className="home-resources">
          <h2>{isRu ? 'Ресурсы' : 'Resources'}</h2>
          <div className="home-resources__grid">
            {RESOURCES.map((res) => (
              <div
                key={res.id}
                className={`home-resource-card ${res.disabled ? 'home-resource-card--disabled' : ''}`}
              >
                <span className="home-resource-card__icon">{res.icon}</span>
                <div className="home-resource-card__content">
                  <h3 className="home-resource-card__title">
                    {isRu ? res.title.ru : res.title.en}
                    {res.badge && (
                      <span className="home-resource-card__badge">
                        {isRu ? res.badge.ru : res.badge.en}
                      </span>
                    )}
                  </h3>
                  <p className="home-resource-card__desc">
                    {isRu ? res.desc.ru : res.desc.en}
                  </p>
                </div>
                {res.disabled ? (
                  <span className="home-resource-card__arrow">→</span>
                ) : (
                  <Link to={res.path} className="home-resource-card__link" aria-label={isRu ? res.title.ru : res.title.en}>
                    <span className="home-resource-card__arrow">→</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="home-about">
          <h2>{isRu ? 'О проекте' : 'About'}</h2>
          <p>
            {isRu
              ? 'Фанатский проект для сообщества Clash of Critters. Не связан с Lilith Games / Farlight Games.'
              : 'A fan project for the Clash of Critters community. Not affiliated with Lilith Games / Farlight Games.'}
          </p>
        </section>

        <SiteFooter />
      </div>
    </I18nProvider>
  )
}

export function HomePage() {
  return <HomeContent />
}
