import type { ReactNode } from 'react'
import { I18nProvider } from '../i18n'
import { usePersistedLocale } from '../hooks/usePersistedLocale'
import { PublicChrome } from './PublicChrome'
import { SiteFooter } from './SiteFooter'

type Props = {
  children: ReactNode
  showCollectionNav?: boolean
  collectionPath?: string
  onPageSettings?: () => void
  /** Hide Sign in CTA in the header (auth form already on the page). */
  hideAuthCta?: boolean
}

export function PublicAppShell({
  children,
  showCollectionNav,
  collectionPath,
  onPageSettings,
  hideAuthCta,
}: Props) {
  const { locale, setLocale } = usePersistedLocale()

  return (
    <I18nProvider locale={locale} setLocale={setLocale}>
      <PublicChrome
        locale={locale}
        onLocaleChange={setLocale}
        showCollectionNav={showCollectionNav}
        collectionPath={collectionPath}
        onPageSettings={onPageSettings}
        hideAuthCta={hideAuthCta}
      />
      {children}
      <SiteFooter />
    </I18nProvider>
  )
}
