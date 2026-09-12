/** Client-side cookie consent. Functional cookies must not be written until accepted. */

export const COOKIE_CONSENT_STORAGE_KEY = 'card-trades-cookies-accepted'
export const COOKIE_CONSENT_COOKIE = 'cookie_consent'
export const COOKIE_CONSENT_EVENT = 'card-trades-cookie-consent'
const CONSENT_MAX_AGE_SEC = 365 * 24 * 60 * 60

function hasConsentCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some((part) => part.trim() === `${COOKIE_CONSENT_COOKIE}=1`)
}

function writeConsentCookie() {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE_CONSENT_COOKIE}=1; Path=/; Max-Age=${CONSENT_MAX_AGE_SEC}; SameSite=Strict${secure}`
}

export function hasCookieConsent(): boolean {
  try {
    if (localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === '1') return true
  } catch {
    // ignore
  }
  return hasConsentCookie()
}

/** If older clients only stored localStorage, mirror it into the consent cookie for the API. */
export function syncCookieConsentCookie(): boolean {
  const accepted = hasCookieConsent()
  if (!accepted) return false
  if (!hasConsentCookie()) writeConsentCookie()
  try {
    if (localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) !== '1') {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, '1')
    }
  } catch {
    // ignore
  }
  return true
}

export function acceptCookieConsent() {
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, '1')
  } catch {
    // ignore
  }
  writeConsentCookie()
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT))
}
