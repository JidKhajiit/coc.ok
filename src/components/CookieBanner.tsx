import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createTranslator } from '../i18n'
import { usePersistedLocale } from '../hooks/usePersistedLocale'

const COOKIE_CONSENT_KEY = 'card-trades-cookies-accepted'

function readConsent(): boolean {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

export function CookieBanner() {
  const { locale } = usePersistedLocale()
  const t = createTranslator(locale)
  const [accepted, setAccepted] = useState(readConsent)

  if (accepted) return null

  return (
    <div className="cookie-banner" role="dialog" aria-label={t('cookies.bannerAria')}>
      <p className="cookie-banner__text">{t('cookies.bannerText')}</p>
      <div className="cookie-banner__actions">
        <Link to="/terms" className="cookie-banner__link">
          {t('legal.termsLink')}
        </Link>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => {
            try {
              localStorage.setItem(COOKIE_CONSENT_KEY, '1')
            } catch {
              // ignore
            }
            setAccepted(true)
          }}
        >
          {t('cookies.accept')}
        </button>
      </div>
    </div>
  )
}
