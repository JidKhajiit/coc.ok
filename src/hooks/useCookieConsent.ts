import { useCallback, useEffect, useState } from 'react'
import {
  COOKIE_CONSENT_EVENT,
  acceptCookieConsent,
  hasCookieConsent,
  syncCookieConsentCookie,
} from '../lib/cookieConsent'

export function useCookieConsent() {
  const [accepted, setAccepted] = useState(() => {
    syncCookieConsentCookie()
    return hasCookieConsent()
  })

  useEffect(() => {
    const onChange = () => setAccepted(hasCookieConsent())
    window.addEventListener(COOKIE_CONSENT_EVENT, onChange)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onChange)
  }, [])

  const accept = useCallback(() => {
    acceptCookieConsent()
    setAccepted(true)
  }, [])

  return { accepted, accept }
}
