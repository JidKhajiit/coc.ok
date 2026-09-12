import { Link } from 'react-router-dom'
import { createTranslator } from '../i18n'
import { usePersistedLocale } from '../hooks/usePersistedLocale'
import { useCookieConsent } from '../hooks/useCookieConsent'

export function CookieBanner() {
  const { locale } = usePersistedLocale()
  const t = createTranslator(locale)
  const { accepted, accept } = useCookieConsent()

  if (accepted) return null

  return (
    <div className="cookie-banner" role="dialog" aria-label={t('cookies.bannerAria')}>
      <p className="cookie-banner__text">{t('cookies.bannerText')}</p>
      <div className="cookie-banner__actions">
        <Link to="/terms" className="cookie-banner__link">
          {t('legal.termsLink')}
        </Link>
        <button type="button" className="btn btn--primary btn--sm" onClick={accept}>
          {t('cookies.accept')}
        </button>
      </div>
    </div>
  )
}
