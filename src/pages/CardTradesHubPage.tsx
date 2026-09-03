import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { I18nProvider } from '../i18n'
import { usePersistedLocale } from '../hooks/usePersistedLocale'
import { PublicChrome } from '../components/PublicChrome'
import { CARDS, SETS } from '../data/cards'
import * as api from '../api/client'
import '../App.css'

type Event = {
  id: string
  name: { ru: string; en: string }
  path: string
  active: boolean
  badge?: { ru: string; en: string }
  icon: string
  description: { ru: string; en: string }
}

const EVENTS: Event[] = [
  {
    id: 'summer-party',
    name: { ru: 'Летняя вечеринка', en: 'Summer Party' },
    path: '/card-trades/summer-party',
    active: true,
    icon: '🎉',
    description: {
      ru: `${CARDS.length} карт в ${SETS.length} сетах. Обменивайтесь с другими игроками!`,
      en: `${CARDS.length} cards in ${SETS.length} sets. Trade with other players!`,
    },
  },
  {
    id: 'new-journey',
    name: { ru: 'New Journey', en: 'New Journey' },
    path: '/card-trades/new-journey',
    active: false,
    icon: '🚀',
    badge: { ru: 'архив', en: 'archived' },
    description: {
      ru: 'Первый карточный эвент. Эвент завершён.',
      en: 'The first card event. Event ended.',
    },
  },
]

function collectionStats(owned: Record<string, number>) {
  let uniqueOwned = 0
  let duplicates = 0
  for (const card of CARDS) {
    const qty = owned[card.id] ?? 0
    if (qty > 0) uniqueOwned += 1
    if (qty > 1) duplicates += qty - 1
  }
  return { uniqueOwned, duplicates }
}

function CardTradesHubContent() {
  const { locale, setLocale } = usePersistedLocale()
  const auth = useAuth()
  const isRu = locale === 'ru'
  const [owned, setOwned] = useState<Record<string, number>>({})

  useEffect(() => {
    if (auth.status !== 'authenticated') {
      setOwned({})
      return
    }

    let cancelled = false
    void api
      .getState()
      .then((data) => {
        if (!cancelled) setOwned(data.owned)
      })
      .catch(() => {
        if (!cancelled) setOwned({})
      })

    return () => {
      cancelled = true
    }
  }, [auth.status])

  const { uniqueOwned, duplicates } = collectionStats(owned)

  return (
    <I18nProvider locale={locale} setLocale={setLocale}>
      <PublicChrome locale={locale} onLocaleChange={setLocale} />

      <div className="app app--hub">
        <div className="atmosphere" aria-hidden />

        <header className="hub-hero">
          <Link to="/" className="hub-hero__back">
            ← {isRu ? 'На главную' : 'Back to Home'}
          </Link>
          <h1 className="hub-hero__title">
            🃏 {isRu ? 'Трекер обменов' : 'Card Trades Tracker'}
          </h1>
          <p className="hub-hero__tagline">
            {isRu
              ? 'Коллекция, повторы, вишлист и история — всё в одном месте.'
              : 'Collection, duplicates, wishlist and history — all in one place.'}
          </p>
        </header>

        <section className="hub-stats">
          <h2>{isRu ? 'Статистика' : 'Stats'}</h2>
          <div className="hub-stats__grid">
            <div className="hub-stat">
              <span className="hub-stat__value">
                {uniqueOwned}
                <span className="hub-stat__total">/{CARDS.length}</span>
              </span>
              <span className="hub-stat__label">{isRu ? 'Карт в коллекции' : 'Cards collected'}</span>
            </div>
            <div className="hub-stat">
              <span className="hub-stat__value">{duplicates}</span>
              <span className="hub-stat__label">{isRu ? 'Дублей' : 'Duplicates'}</span>
            </div>
            <div className="hub-stat">
              <span className="hub-stat__value">∞</span>
              <span className="hub-stat__label">{isRu ? 'Возможных обменов' : 'Possible trades'}</span>
            </div>
          </div>
        </section>

        <section className="hub-welcome">
          <p>
            {isRu
              ? 'Отслеживайте свою коллекцию карт, создавайте вишлист и находите игроков для обмена. Выберите эвент, чтобы начать.'
              : 'Track your card collection, create a wishlist, and find players to trade with. Choose an event to get started.'}
          </p>
          {auth.status === 'unauthenticated' && (
            <p className="hub-welcome__cta">
              <Link to="/card-trades/summer-party" className="btn btn--primary">
                {isRu ? 'Войти / Регистрация' : 'Sign In / Register'}
              </Link>
            </p>
          )}
        </section>

        <section className="hub-events">
          <h2>{isRu ? 'Карточные эвенты' : 'Card Events'}</h2>
          <div className="hub-events__grid">
            {EVENTS.map((event) => (
              <div
                key={event.id}
                className={`hub-event-card ${!event.active ? 'hub-event-card--disabled' : ''}`}
              >
                <span className="hub-event-card__icon">{event.icon}</span>
                <div className="hub-event-card__content">
                  <h3 className="hub-event-card__name">
                    {isRu ? event.name.ru : event.name.en}
                    {event.badge && (
                      <span className="hub-event-card__badge">
                        {isRu ? event.badge.ru : event.badge.en}
                      </span>
                    )}
                  </h3>
                  <p className="hub-event-card__desc">
                    {isRu ? event.description.ru : event.description.en}
                  </p>
                </div>
                {event.active ? (
                  <Link to={event.path} className="btn btn--primary hub-event-card__btn">
                    {isRu ? 'Открыть трекер' : 'Open Tracker'}
                  </Link>
                ) : (
                  <button className="btn btn--outline hub-event-card__btn" disabled>
                    {isRu ? 'Скоро' : 'Soon'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <footer className="hub-footer">
          <Link to="/">← {isRu ? 'Все ресурсы' : 'All resources'}</Link>
        </footer>
      </div>
    </I18nProvider>
  )
}

export function CardTradesHubPage() {
  return <CardTradesHubContent />
}
