/**
 * Site-level event routing: `/{eventSlug}` forks to the right app,
 * public shares live at `/{eventSlug}/{uid}`.
 */

export type EventKind = 'card-trades' | 'cozy-farm'

/** Top-level paths that are never event slugs. */
export const RESERVED_SITE_SLUGS = new Set([
  'card-trades',
  'admin-panel',
  'guides',
  'database',
  'tier-list',
])

/** Static (non-API) events and their app kind. */
export const STATIC_EVENT_KINDS: Record<string, EventKind> = {
  'cozy-farm': 'cozy-farm',
}

/** Nested segments under a card-trades event that are app tabs, not UIDs. */
export const CARD_TRADE_APP_SEGMENTS = new Set([
  'wishlist',
  'trades',
  'trends',
  'collections',
])

export function isReservedSiteSlug(slug: string): boolean {
  return RESERVED_SITE_SLUGS.has(slug)
}

export function getStaticEventKind(slug: string): EventKind | null {
  return STATIC_EVENT_KINDS[slug] ?? null
}

/** Card-trades events come from API; everything else static or unknown. */
export function isCardTradesEventSlug(slug: string): boolean {
  if (!slug || isReservedSiteSlug(slug)) return false
  return getStaticEventKind(slug) === null
}

export function eventPath(eventSlug: string): string {
  return `/${eventSlug}`
}

export function eventTabPath(
  eventSlug: string,
  tab: 'wishlist' | 'trades' | 'trends',
): string {
  return `/${eventSlug}/${tab}`
}

export function collectionPath(eventSlug: string, uid: string): string {
  return `/${eventSlug}/${encodeURIComponent(uid)}`
}

export function collectionNeededPath(eventSlug: string, uid: string): string {
  return `${collectionPath(eventSlug, uid)}/needed`
}

export function collectionsListPath(eventSlug: string): string {
  return `/${eventSlug}/collections`
}
