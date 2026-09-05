import type { Account, AppState, Card, TrendItem } from '../types'
import type { CardSet } from '../data/cards'

export type PublicCollection = {
  slug: string
  username: string
  owned: Record<string, number>
  neededBy: Record<string, string[]>
  accounts: Account[]
  updatedAt: string
  stats: {
    uniqueOwned: number
    neededCount: number
  }
  event: {
    slug: string
    name: string
    cardCount: number
  }
}

export type PublicCollectionSummary = {
  slug: string
  username: string
  updatedAt: string
  stats: {
    uniqueOwned: number
    neededCount: number
  }
  event: {
    slug: string
    name: string
    cardCount: number
  }
}

export type ShareSettings = {
  enabled: boolean
  slug: string
}

export type CardTradeEventSummary = {
  id: string
  slug: string
  name: string
  startDate: string
  endDate: string
  active: boolean
  cardCount: number
  setCount: number
}

export type CardTradeEvent = CardTradeEventSummary & {
  sets: CardSet[]
  cards: Card[]
}

export type CardTradeEventTrends = {
  mostGiven: TrendItem[]
  mostRequested: TrendItem[]
  tradeCount: number
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export type AuthUser = {
  id: string
  username: string
  permissions: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Types
// ─────────────────────────────────────────────────────────────────────────────

export type AdminUser = {
  id: string
  username: string
  email: string | null
  emailVerified: boolean
  createdAt: string
  roles: Array<{ id: string; name: string }>
}

export type AdminRole = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: Array<{ id: string; name: string }>
}

export type AdminPermission = {
  id: string
  name: string
  description: string | null
}

export type CreateCardTradeEventInput = {
  slug: string
  name: string
  startDate: string
  endDate: string
  sets: CardSet[]
  cards: Array<{
    number: number
    name: string
    rarity: 1 | 2 | 3 | 4 | 5
    color: 'blue' | 'gold'
    unknownName?: boolean
  }>
}

export type UpdateCardTradeEventInput = Omit<CreateCardTradeEventInput, 'slug'>

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof body.error === 'string' ? body.error : `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }
  return body as T
}

export async function getMe(): Promise<AuthUser | null> {
  const { user } = await request<{ user: AuthUser | null }>('/api/auth/me')
  return user
}

export async function login(login: string, password: string): Promise<AuthUser> {
  const { user } = await request<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  })
  return user
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<{ needsVerification: boolean; message: string }> {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })
}

export async function verifyEmail(token: string): Promise<void> {
  await request('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return request('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await request('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  return request('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' })
}

export async function getState(): Promise<AppState> {
  const { data } = await request<{ data: AppState }>('/api/state')
  return data
}

export async function putState(state: AppState): Promise<AppState> {
  const { data } = await request<{ data: AppState }>('/api/state', {
    method: 'PUT',
    body: JSON.stringify(state),
  })
  return data
}

export async function listPublicCollections(): Promise<PublicCollectionSummary[]> {
  const { collections } = await request<{ collections: PublicCollectionSummary[] }>(
    '/api/card-trades/collections',
  )
  return collections
}

export async function getPublicCollection(slug: string): Promise<PublicCollection> {
  const { collection } = await request<{ collection: PublicCollection }>(
    `/api/card-trades/collections/${encodeURIComponent(slug)}`,
  )
  return collection
}

export async function getShareSettings(): Promise<ShareSettings> {
  const { share } = await request<{ share: ShareSettings }>('/api/card-trades/share')
  return share
}

export async function updateShareSettings(settings: ShareSettings): Promise<ShareSettings> {
  const { share } = await request<{ share: ShareSettings }>('/api/card-trades/share', {
    method: 'PUT',
    body: JSON.stringify({ enabled: settings.enabled, slug: settings.slug }),
  })
  return share
}

export async function listCardTradeEvents(): Promise<CardTradeEventSummary[]> {
  const { events } = await request<{ events: CardTradeEventSummary[] }>('/api/card-trades/events')
  return events
}

export async function getCardTradeEvent(eventSlug: string): Promise<CardTradeEvent> {
  const { event } = await request<{ event: CardTradeEvent }>(
    `/api/card-trades/events/${encodeURIComponent(eventSlug)}`,
  )
  return event
}

export async function getEventState(eventSlug: string): Promise<AppState> {
  const { data } = await request<{ data: AppState }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/state`,
  )
  return data
}

export async function putEventState(eventSlug: string, state: AppState): Promise<AppState> {
  const { data } = await request<{ data: AppState }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/state`,
    {
      method: 'PUT',
      body: JSON.stringify(state),
    },
  )
  return data
}

export async function getEventTrends(eventSlug: string): Promise<CardTradeEventTrends> {
  const { trends } = await request<{ trends: CardTradeEventTrends }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/trends`,
  )
  return trends
}

export async function listEventPublicCollections(eventSlug: string): Promise<PublicCollectionSummary[]> {
  const { collections } = await request<{ collections: PublicCollectionSummary[] }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/collections`,
  )
  return collections
}

export async function getEventPublicCollection(
  eventSlug: string,
  slug: string,
): Promise<{ collection: PublicCollection; event: CardTradeEvent }> {
  return request<{ collection: PublicCollection; event: CardTradeEvent }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/collections/${encodeURIComponent(slug)}`,
  )
}

export async function getEventShareSettings(eventSlug: string): Promise<ShareSettings> {
  const { share } = await request<{ share: ShareSettings }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/share`,
  )
  return share
}

export async function updateEventShareSettings(
  eventSlug: string,
  settings: ShareSettings,
): Promise<ShareSettings> {
  const { share } = await request<{ share: ShareSettings }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/share`,
    {
      method: 'PUT',
      body: JSON.stringify({ enabled: settings.enabled, slug: settings.slug }),
    },
  )
  return share
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin API
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminUsers(): Promise<AdminUser[]> {
  const { users } = await request<{ users: AdminUser[] }>('/api/admin/users')
  return users
}

export async function updateUserRoles(userId: string, roleIds: string[]): Promise<void> {
  await request(`/api/admin/users/${userId}/roles`, {
    method: 'PUT',
    body: JSON.stringify({ roleIds }),
  })
}

export async function deleteUser(userId: string): Promise<void> {
  await request(`/api/admin/users/${userId}`, { method: 'DELETE' })
}

export async function getAdminRoles(): Promise<AdminRole[]> {
  const { roles } = await request<{ roles: AdminRole[] }>('/api/admin/roles')
  return roles
}

export async function createRole(data: {
  name: string
  description?: string
  permissionIds?: string[]
}): Promise<{ id: string; name: string }> {
  const { role } = await request<{ role: { id: string; name: string } }>('/api/admin/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return role
}

export async function updateRole(
  roleId: string,
  data: { name?: string; description?: string; permissionIds?: string[] },
): Promise<void> {
  await request(`/api/admin/roles/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteRole(roleId: string): Promise<void> {
  await request(`/api/admin/roles/${roleId}`, { method: 'DELETE' })
}

export async function getAdminPermissions(): Promise<AdminPermission[]> {
  const { permissions } = await request<{ permissions: AdminPermission[] }>('/api/admin/permissions')
  return permissions
}

export async function createAdminCardTradeEvent(
  data: CreateCardTradeEventInput,
): Promise<CardTradeEvent> {
  const { event } = await request<{ event: CardTradeEvent }>('/api/card-trades/admin/events', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return event
}

export async function updateAdminCardTradeEvent(
  eventId: string,
  data: UpdateCardTradeEventInput,
): Promise<CardTradeEvent> {
  const { event } = await request<{ event: CardTradeEvent }>(
    `/api/card-trades/admin/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
  )
  return event
}

// ─────────────────────────────────────────────────────────────────────────────
// Database Backup
// ─────────────────────────────────────────────────────────────────────────────

export type DatabaseBackup = {
  version: number
  exportedAt: string
  data: {
    users: unknown[]
    userStates: unknown[]
    roles: unknown[]
    permissions: unknown[]
    userRoles: unknown[]
    rolePermissions: unknown[]
  }
}

export async function exportDatabaseBackup(): Promise<DatabaseBackup> {
  return request<DatabaseBackup>('/api/admin/backup')
}

export async function importDatabaseBackup(
  backup: DatabaseBackup,
): Promise<{ imported: Record<string, number> }> {
  return request('/api/admin/backup', {
    method: 'POST',
    body: JSON.stringify(backup),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Cozy Farm
// ─────────────────────────────────────────────────────────────────────────────

export type CozyFarmListing = {
  id: string
  userId: string
  username: string
  gameUid: string
  bonusDragonfruit: number | null
  bonusCarrot: number | null
  bonusBamboo: number | null
  bonusPhantom: number | null
  bonusCranberry: number | null
  bonusOrange: number | null
  likes: number
  dislikes: number
  myVote: 1 | -1 | null
  createdAt: string
  updatedAt: string
}

export type CozyFarmListingInput = {
  gameUid: string
  bonusDragonfruit?: number | null
  bonusCarrot?: number | null
  bonusBamboo?: number | null
  bonusPhantom?: number | null
  bonusCranberry?: number | null
  bonusOrange?: number | null
}

export async function listCozyFarmListings(): Promise<CozyFarmListing[]> {
  const { listings } = await request<{ listings: CozyFarmListing[] }>('/api/cozy-farm/listings')
  return listings
}

export async function createCozyFarmListing(
  data: CozyFarmListingInput,
): Promise<{ listing: unknown }> {
  return request('/api/cozy-farm/listings', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCozyFarmListing(
  id: string,
  data: CozyFarmListingInput,
): Promise<{ listing: unknown }> {
  return request(`/api/cozy-farm/listings/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteCozyFarmListing(id: string): Promise<void> {
  await request(`/api/cozy-farm/listings/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function voteCozyFarmListing(
  id: string,
  value: 1 | -1 | 0,
): Promise<{ myVote: 1 | -1 | null }> {
  return request(`/api/cozy-farm/listings/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ value }),
  })
}
