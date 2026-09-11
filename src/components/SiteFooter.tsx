import { Link } from 'react-router-dom'
import { createTranslator } from '../i18n'
import { usePersistedLocale } from '../hooks/usePersistedLocale'
import { CookieBanner } from './CookieBanner'

export function SiteFooter() {
  const { locale } = usePersistedLocale()
  const t = createTranslator(locale)

  return (
    <>
      <footer className="site-footer">
        <p>{t('site.footer')}</p>
        <p className="site-footer__links">
          <Link to="/terms">{t('legal.termsLink')}</Link>
        </p>
      </footer>
      <CookieBanner />
    </>
  )
}
