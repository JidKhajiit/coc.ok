/** Safe post-login redirect targets (same-origin relative paths only). */

const BLOCKED_PREFIXES = ['/login', '/card-trades/verify-email', '/card-trades/reset-password']

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  let value = raw.trim()
  try {
    value = decodeURIComponent(value)
  } catch {
    return null
  }
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('://')) return null
  if (value === '/') return null
  for (const prefix of BLOCKED_PREFIXES) {
    if (value === prefix || value.startsWith(`${prefix}?`) || value.startsWith(`${prefix}/`)) {
      return null
    }
  }
  return value
}

export function loginPath(next?: string | null): string {
  const safe = safeNextPath(next)
  if (!safe) return '/login'
  return `/login?next=${encodeURIComponent(safe)}`
}

export const DEFAULT_POST_LOGIN_PATH = '/card-trades'
