import { useCallback, useEffect, useState } from 'react'
import { localeTag, normalizeLocale, type Locale } from '../i18n'

export const LOCALE_STORAGE_KEY = 'card-trades-locale'

export function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (raw) return normalizeLocale(raw)
  } catch {
    // ignore
  }
  return 'ru'
}

export function writeStoredLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, normalizeLocale(locale))
  } catch {
    // ignore
  }
}

export function usePersistedLocale() {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)

  const setLocale = useCallback((next: Locale) => {
    const normalized = normalizeLocale(next)
    writeStoredLocale(normalized)
    setLocaleState(normalized)
  }, [])

  useEffect(() => {
    document.documentElement.lang = localeTag(locale)
  }, [locale])

  return { locale, setLocale }
}
