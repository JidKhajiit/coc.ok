import { Link } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import { usePersistedLocale } from '../hooks/usePersistedLocale'
import { PublicChrome } from '../components/PublicChrome'
import { BRAND_NAME } from '../brand'
import '../App.css'

type Resource = {
  id: string
  icon: string
  title: { ru: string; en: string }
  desc: { ru: string; en: string }
  path: string
  badge?: { ru: string; en: string }
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

function HomeContent() {
  const { locale, setLocale } = usePersistedLocale()
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

        <footer className="home-footer">
          <p>
            {isRu
              ? 'Создано фанатами для фанатов'
              : 'Made by fans for fans'}
          </p>
        </footer>
      </div>
    </I18nProvider>
  )
}

export function HomePage() {
  return <HomeContent />
}
