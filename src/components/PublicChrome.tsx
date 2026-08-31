import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useI18n, type Locale } from '../i18n'
import { BRAND_NAME } from '../brand'
import { SiteSettingsDrawer } from './settings/SiteSettingsDrawer'

type Props = {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

export function PublicChrome({ locale, onLocaleChange }: Props) {
  const { t } = useI18n()
  const location = useLocation()
  const auth = useAuth()
  const [siteOpen, setSiteOpen] = useState(false)

  const onLoginPage = location.pathname === '/card-trades' && auth.status === 'unauthenticated'
  const showAppCta = auth.status !== 'loading' && !onLoginPage

  return (
    <>
      <header className="public-chrome">
        <nav className="public-chrome__nav" aria-label={t('nav.public')}>
          <Link to="/card-trades" className="public-chrome__brand">
            {BRAND_NAME}
          </Link>
          <Link to="/card-trades/collections" className="public-chrome__link">
            {t('share.browseCollections')}
          </Link>
        </nav>

        <div className="public-chrome__actions">
          {showAppCta &&
            (auth.user ? (
              <Link to="/card-trades" className="public-chrome__app-link">
                <span className="public-chrome__avatar" aria-hidden>
                  {auth.user.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="public-chrome__app-label">{t('share.backToApp')}</span>
              </Link>
            ) : (
              <Link to="/card-trades" className="btn btn--primary btn--sm public-chrome__cta">
                {t('auth.login')}
              </Link>
            ))}

          <button
            type="button"
            className="public-chrome__site-btn"
            onClick={() => setSiteOpen(true)}
            aria-label={t('app.siteSettings')}
            title={t('app.siteSettings')}
          >
            <span aria-hidden>◐</span>
            <span className="public-chrome__site-label">{t('app.siteSettingsShort')}</span>
          </button>
        </div>
      </header>

      <SiteSettingsDrawer
        open={siteOpen}
        onClose={() => setSiteOpen(false)}
        username={auth.user?.username}
        onLogout={auth.user ? auth.logout : undefined}
        locale={locale}
        onLocaleChange={onLocaleChange}
      />
    </>
  )
}
