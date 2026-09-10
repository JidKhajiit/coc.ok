import { randomBytes } from 'node:crypto'

/** Opaque public collection link token (not game UID). */
export function generateShareSlug(): string {
  return randomBytes(9).toString('base64url').slice(0, 12)
}

export function looksLikeOpaqueShareSlug(slug: string, gameUid: string | null | undefined): boolean {
  if (!slug) return false
  if (gameUid && slug === gameUid) return false
  return /^[a-zA-Z0-9_-]{8,64}$/.test(slug)
}
