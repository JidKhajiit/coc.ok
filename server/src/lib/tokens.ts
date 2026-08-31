import { createHash, randomBytes } from 'node:crypto'

export type AuthTokenType = 'email_verify' | 'password_reset'

export function generateAuthToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  const hash = hashAuthToken(token)
  return { token, hash }
}

export function hashAuthToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function authTokenExpiry(type: AuthTokenType): Date {
  const hours = type === 'email_verify' ? 48 : 2
  const d = new Date()
  d.setHours(d.getHours() + hours)
  return d
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
