import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  createTranslator,
  type Locale,
  type TranslateFn,
} from './messages'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TranslateFn
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  locale,
  setLocale,
  children,
}: {
  locale: Locale
  setLocale: (locale: Locale) => void
  children: ReactNode
}) {
  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: createTranslator(locale),
    }),
    [locale, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
