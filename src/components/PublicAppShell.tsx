import type { ReactNode } from 'react'
import { I18nProvider } from '../i18n'
import { usePersistedLocale } from '../hooks/usePersistedLocale'
import { PublicChrome } from './PublicChrome'
import { SiteFooter } from './SiteFooter'

export function PublicAppShell({ children }: { children: ReactNode }) {
  const { locale, setLocale } = usePersistedLocale()

  return (
    <I18nProvider locale={locale} setLocale={setLocale}>
      <PublicChrome locale={locale} onLocaleChange={setLocale} />
      {children}
      <SiteFooter />
    </I18nProvider>
  )
}
