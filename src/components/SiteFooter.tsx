import { createTranslator } from '../i18n'
import { usePersistedLocale } from '../hooks/usePersistedLocale'

export function SiteFooter() {
  const { locale } = usePersistedLocale()
  const t = createTranslator(locale)

  return (
    <footer className="site-footer">
      <p>{t('site.footer')}</p>
    </footer>
  )
}
