import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { I18nProvider } from '../i18n'
import { usePersistedLocale } from '../hooks/usePersistedLocale'
import { PublicChrome } from '../components/PublicChrome'
import { BRAND_NAME } from '../brand'
import '../App.css'

type Event = {
  id: string
  name: { ru: string; en: string }
  path: string
  active: boolean
  badge?: { ru: string; en: string }
  icon: string
}

const EVENTS: Event[] = [
  {
    id: 'summer-party',
    name: { ru: 'Летняя вечеринка', en: 'Summer Party' },
    path: '/card-trades/summer-party',
    active: true,
    icon: '🎉',
  },
  {
    id: 'cozy-farm',
    name: { ru: 'Cozy Farm', en: 'Cozy Farm' },
    path: '/card-trades/cozy-farm',
    active: false,
    badge: { ru: 'в разработке', en: 'coming soon' },
    icon: '🌾',
  },
]

function HomeContent() {
  const { locale, setLocale } = usePersistedLocale()
  const auth = useAuth()
  const isRu = locale === 'ru'

  return (
    <I18nProvider locale={locale} setLocale={setLocale}>
      <PublicChrome locale={locale} onLocaleChange={setLocale} />

      <div className="app app--home">
        <div className="atmosphere" aria-hidden />

        <header className="home-hero">
          <h1 className="home-hero__brand">{BRAND_NAME}</h1>
          <p className="home-hero__tagline">
            {isRu
              ? 'Трекер коллекций и обменов для мини-игр'
              : 'Collection & trade tracker for mini-games'}
          </p>
        </header>

        <section className="home-welcome">
          <h2>{isRu ? 'Добро пожаловать!' : 'Welcome!'}</h2>
          <p>
            {isRu
              ? 'Отслеживайте свою коллекцию карт, находите нужные обмены и следите за прогрессом в различных игровых эвентах.'
              : 'Track your card collection, find trades you need, and monitor your progress across different game events.'}
          </p>
          {auth.status === 'unauthenticated' && (
            <p className="home-welcome__cta">
              {isRu ? (
                <>
                  <Link to="/card-trades/summer-party" className="btn btn--primary">
                    Войти / Регистрация
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/card-trades/summer-party" className="btn btn--primary">
                    Sign In / Register
                  </Link>
                </>
              )}
            </p>
          )}
        </section>

        <section className="home-events">
          <h2>{isRu ? 'Игровые эвенты' : 'Game Events'}</h2>
          <div className="home-events__grid">
            {EVENTS.map((event) => (
              <div
                key={event.id}
                className={`home-event-card ${!event.active ? 'home-event-card--disabled' : ''}`}
              >
                <span className="home-event-card__icon">{event.icon}</span>
                <h3 className="home-event-card__name">
                  {isRu ? event.name.ru : event.name.en}
                </h3>
                {event.badge && (
                  <span className="home-event-card__badge">
                    {isRu ? event.badge.ru : event.badge.en}
                  </span>
                )}
                {event.active ? (
                  <Link to={event.path} className="btn btn--primary home-event-card__btn">
                    {isRu ? 'Открыть' : 'Open'}
                  </Link>
                ) : (
                  <button className="btn btn--outline home-event-card__btn" disabled>
                    {isRu ? 'Скоро' : 'Soon'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="home-stats">
          <h2>{isRu ? 'Статистика сайта' : 'Site Stats'}</h2>
          <div className="home-stats__grid">
            <div className="home-stat">
              <span className="home-stat__value">1</span>
              <span className="home-stat__label">{isRu ? 'Активных эвентов' : 'Active events'}</span>
            </div>
            <div className="home-stat">
              <span className="home-stat__value">48</span>
              <span className="home-stat__label">{isRu ? 'Карт в коллекции' : 'Cards to collect'}</span>
            </div>
            <div className="home-stat">
              <span className="home-stat__value">∞</span>
              <span className="home-stat__label">{isRu ? 'Возможных обменов' : 'Possible trades'}</span>
            </div>
          </div>
        </section>

        <footer className="home-footer">
          <p>
            {isRu
              ? 'Создано фанатами для фанатов Clash of Critters'
              : 'Made by fans for Clash of Critters fans'}
          </p>
        </footer>
      </div>
    </I18nProvider>
  )
}

export function HomePage() {
  return <HomeContent />
}
