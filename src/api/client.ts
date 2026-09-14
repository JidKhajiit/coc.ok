import type { AppState, Card, FavoriteFolder, TrendItem } from '../types'
import type { CardSet } from '../data/cards'

export type PopularityTier = 'S' | 'A' | 'B' | 'C' | 'D'

export type PublicCollection = {
  slug: string
  username: string
  acceptTradeOffers: boolean
  owned: Record<string, number>
  neededBy: Record<string, string[]>
  favoriteFolders: FavoriteFolder[]
  updatedAt: string
  stats: {
    uniqueOwned: number
    neededCount: number
    tradeable: number
    tradesToday: number
    tradeAttemptsLeft: number
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
  acceptTradeOffers: boolean
  updatedAt: string
  stats: {
    uniqueOwned: number
    neededCount: number
    tradeable: number
    tradesToday: number
    tradeAttemptsLeft: number
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
  acceptTradeOffers: boolean
}

export type CardStats = {
  cardId: string
  givenCount: number
  requestedCount: number
  score: number
  rank: number | null
  totalCards: number
  tier: PopularityTier
}

export type TradeProposalType = 'trade' | 'gift'

export type TradeProposal = {
  id: string
  type: TradeProposalType
  status: string
  offeredCardKey: string | null
  requestedCardKey: string
  createdAt: string
  updatedAt: string
  direction: 'incoming' | 'outgoing'
  counterparty: {
    username: string
    shareSlug: string | null
    uid: string | null
  }
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
  body: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export type EventStatePayload = {
  data: AppState
  updatedAt: string | null
  updatedByUserId: string | null
  updatedByUsername: string | null
}

export function getConflictPayload(err: unknown): EventStatePayload | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null
  const body = err.body
  if (!body || typeof body !== 'object') return null
  const data = 'data' in body ? body.data : null
  const updatedAt = 'updatedAt' in body ? body.updatedAt : null
  if (!data || typeof data !== 'object') return null
  const updatedByUserId = 'updatedByUserId' in body ? body.updatedByUserId : null
  const updatedByUsername = 'updatedByUsername' in body ? body.updatedByUsername : null
  return {
    data: data as AppState,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : null,
    updatedByUserId: typeof updatedByUserId === 'string' ? updatedByUserId : null,
    updatedByUsername: typeof updatedByUsername === 'string' ? updatedByUsername : null,
  }
}

export type AuthUser = {
  id: string
  username: string
  activeProfileId: string | null
  avatarUrl: string | null
  permissions: string[]
}

export type DeviceAccount = {
  id: string
  username: string
  avatarUrl: string | null
  active: boolean
}

export type GameProfile = {
  id: string
  gameUid: string
  nickname: string
  ownerUserId: string
  role?: 'owner' | 'admin' | string
  createdAt?: string
}

export type ProfileMember = {
  userId: string
  username: string
  role: string
}

export type ProfileClaim = {
  id: string
  profileId: string
  gameUid: string
  nickname: string
  claimantUserId: string
  claimantUsername: string
  screenshotPath: string
  message: string | null
  status: string
  createdAt: string
  ownerUserId: string
}

export type AuthSessionPayload = {
  user: AuthUser | null
  accounts: DeviceAccount[]
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
    throw new ApiError(message, res.status, body)
  }
  return body as T
}

export async function getMe(): Promise<AuthSessionPayload> {
  return request<AuthSessionPayload>('/api/auth/me')
}

export async function login(login: string, password: string): Promise<AuthSessionPayload> {
  return request<AuthSessionPayload>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  })
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

export async function uploadAvatar(file: File): Promise<AuthSessionPayload> {
  const form = new FormData()
  form.append('avatar', file)
  const res = await fetch('/api/auth/avatar', {
    method: 'PUT',
    credentials: 'include',
    body: form,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof body.error === 'string' ? body.error : `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }
  return body as AuthSessionPayload
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

export async function logout(): Promise<AuthSessionPayload> {
  return request<AuthSessionPayload>('/api/auth/logout', { method: 'POST' })
}

export async function listDeviceAccounts(): Promise<DeviceAccount[]> {
  const { accounts } = await request<{ accounts: DeviceAccount[] }>('/api/auth/accounts')
  return accounts
}

export async function switchAccount(userId: string): Promise<AuthSessionPayload> {
  return request<AuthSessionPayload>('/api/auth/switch', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

export async function removeDeviceAccount(userId: string): Promise<AuthSessionPayload> {
  return request<AuthSessionPayload>('/api/auth/accounts/remove', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
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

export async function updateShareSettings(settings: {
  enabled: boolean
  acceptTradeOffers?: boolean
}): Promise<ShareSettings> {
  const { share } = await request<{ share: ShareSettings }>('/api/card-trades/share', {
    method: 'PUT',
    body: JSON.stringify(settings),
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

export async function getEventState(eventSlug: string): Promise<EventStatePayload> {
  return request<EventStatePayload>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/state`,
  )
}

export async function putEventState(
  eventSlug: string,
  state: AppState,
  baseUpdatedAt: string | null,
): Promise<EventStatePayload> {
  return request<EventStatePayload>(`/api/card-trades/${encodeURIComponent(eventSlug)}/state`, {
    method: 'PUT',
    body: JSON.stringify({ data: state, baseUpdatedAt }),
  })
}

export async function getEventTrends(eventSlug: string): Promise<CardTradeEventTrends> {
  const { trends } = await request<{ trends: CardTradeEventTrends }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/trends`,
  )
  return trends
}

export async function listEventPublicCollections(
  eventSlug: string,
  filter?: { cardId: string; role: 'needed' | 'owned' },
): Promise<PublicCollectionSummary[]> {
  const params = new URLSearchParams()
  if (filter) {
    params.set('cardId', filter.cardId)
    params.set('role', filter.role)
  }
  const qs = params.toString()
  const { collections } = await request<{ collections: PublicCollectionSummary[] }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/collections${qs ? `?${qs}` : ''}`,
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
  settings: { enabled: boolean; acceptTradeOffers?: boolean },
): Promise<ShareSettings> {
  const { share } = await request<{ share: ShareSettings }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/share`,
    {
      method: 'PUT',
      body: JSON.stringify({
        enabled: settings.enabled,
        ...(settings.acceptTradeOffers !== undefined
          ? { acceptTradeOffers: settings.acceptTradeOffers }
          : {}),
      }),
    },
  )
  return share
}

export async function getEventCardStats(eventSlug: string, cardId: string): Promise<CardStats> {
  const { stats } = await request<{ stats: CardStats }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/cards/${encodeURIComponent(cardId)}/stats`,
  )
  return stats
}

export async function listEventProposals(
  eventSlug: string,
): Promise<{ incoming: TradeProposal[]; outgoing: TradeProposal[] }> {
  return request<{ incoming: TradeProposal[]; outgoing: TradeProposal[] }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/proposals`,
  )
}

export async function createEventProposal(
  eventSlug: string,
  input: {
    toShareSlug: string
    type: TradeProposalType
    offeredCardKey?: string | null
    requestedCardKey: string
  },
): Promise<TradeProposal> {
  const { proposal } = await request<{ proposal: TradeProposal }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/proposals`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return proposal
}

export async function acceptEventProposal(eventSlug: string, id: string): Promise<TradeProposal> {
  const { proposal } = await request<{ proposal: TradeProposal }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/proposals/${encodeURIComponent(id)}/accept`,
    { method: 'POST' },
  )
  return proposal
}

export async function rejectEventProposal(eventSlug: string, id: string): Promise<TradeProposal> {
  const { proposal } = await request<{ proposal: TradeProposal }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/proposals/${encodeURIComponent(id)}/reject`,
    { method: 'POST' },
  )
  return proposal
}

export async function cancelEventProposal(eventSlug: string, id: string): Promise<TradeProposal> {
  const { proposal } = await request<{ proposal: TradeProposal }>(
    `/api/card-trades/${encodeURIComponent(eventSlug)}/proposals/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  )
  return proposal
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
  data: Record<string, unknown[]>
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
  profileId: string
  nickname: string
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
  gameUid?: string
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

// ─────────────────────────────────────────────────────────────────────────────
// Game Profiles
// ─────────────────────────────────────────────────────────────────────────────

export async function listProfiles(): Promise<{
  profiles: GameProfile[]
  activeProfileId: string | null
}> {
  return request('/api/profiles')
}

export async function createProfile(
  gameUid: string,
  nickname: string,
): Promise<{ profile: GameProfile; activeProfileId: string | null }> {
  return request('/api/profiles', {
    method: 'POST',
    body: JSON.stringify({ gameUid, nickname }),
  })
}

export async function updateProfile(
  id: string,
  nickname: string,
): Promise<{ profile: GameProfile }> {
  return request(`/api/profiles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ nickname }),
  })
}

export async function deleteProfile(
  id: string,
): Promise<{ ok: true; activeProfileId: string | null }> {
  return request(`/api/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function setActiveProfile(
  profileId: string,
): Promise<{ activeProfileId: string; profile: GameProfile }> {
  return request('/api/profiles/active', {
    method: 'PUT',
    body: JSON.stringify({ profileId }),
  })
}

export async function listProfileAdmins(
  profileId: string,
): Promise<{ members: ProfileMember[] }> {
  return request(`/api/profiles/${encodeURIComponent(profileId)}/admins`)
}

export async function addProfileAdmin(
  profileId: string,
  username: string,
): Promise<{ member: ProfileMember }> {
  return request(`/api/profiles/${encodeURIComponent(profileId)}/admins`, {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
}

export async function removeProfileAdmin(profileId: string, userId: string): Promise<{ ok: true }> {
  return request(
    `/api/profiles/${encodeURIComponent(profileId)}/admins/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  )
}

export async function submitProfileClaim(
  profileId: string,
  screenshot: File,
  message?: string,
): Promise<{ claim: { id: string; status: string } }> {
  const form = new FormData()
  form.append('screenshot', screenshot)
  if (message?.trim()) form.append('message', message.trim())
  const res = await fetch(`/api/profiles/${encodeURIComponent(profileId)}/claims`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errMsg = typeof body.error === 'string' ? body.error : `Request failed (${res.status})`
    throw new ApiError(errMsg, res.status, body)
  }
  return body as { claim: { id: string; status: string } }
}

export async function listProfileClaimsQueue(): Promise<{ claims: ProfileClaim[] }> {
  return request('/api/profiles/claims/queue')
}

export async function resolveProfileClaim(
  claimId: string,
  action: 'approve' | 'reject',
): Promise<{ ok: true; status: string }> {
  return request(`/api/profiles/claims/${encodeURIComponent(claimId)}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Site event calendar
// ─────────────────────────────────────────────────────────────────────────────

export type SiteEventType = {
  id: string
  slug: string
  nameRu: string
  nameEn: string
  path: string | null
  color: string | null
  icon: string | null
  createdAt: string
}

export type SiteEventScheduleEntry = {
  id: string
  eventTypeId: string
  startDate: string
  endDate: string
  registrationDays: number
  rewardDays: number
  createdAt: string
  event: {
    slug: string
    nameRu: string
    nameEn: string
    path: string | null
    color: string | null
    icon: string | null
  }
}

export async function listCalendarSchedule(range?: {
  from: string
  to: string
}): Promise<SiteEventScheduleEntry[]> {
  const params = new URLSearchParams()
  if (range) {
    params.set('from', range.from)
    params.set('to', range.to)
  }
  const qs = params.toString()
  const { entries } = await request<{ entries: SiteEventScheduleEntry[] }>(
    `/api/calendar/schedule${qs ? `?${qs}` : ''}`,
  )
  return entries
}

export async function listCalendarTypes(): Promise<SiteEventType[]> {
  const { types } = await request<{ types: SiteEventType[] }>('/api/calendar/types')
  return types
}

export async function listAdminCalendarTypes(): Promise<SiteEventType[]> {
  const { types } = await request<{ types: SiteEventType[] }>('/api/calendar/admin/types')
  return types
}

export async function createAdminCalendarType(data: {
  slug: string
  nameRu: string
  nameEn: string
  path?: string | null
  color?: string | null
  icon?: string | null
}): Promise<SiteEventType> {
  const { type } = await request<{ type: SiteEventType }>('/api/calendar/admin/types', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return type
}

export async function updateAdminCalendarType(
  id: string,
  data: {
    nameRu?: string
    nameEn?: string
    path?: string | null
    color?: string | null
    icon?: string | null
  },
): Promise<SiteEventType> {
  const { type } = await request<{ type: SiteEventType }>(
    `/api/calendar/admin/types/${encodeURIComponent(id)}`,
    { method: 'PUT', body: JSON.stringify(data) },
  )
  return type
}

export async function deleteAdminCalendarType(id: string): Promise<void> {
  await request(`/api/calendar/admin/types/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function listAdminCalendarSchedule(): Promise<SiteEventScheduleEntry[]> {
  const { entries } = await request<{ entries: SiteEventScheduleEntry[] }>(
    '/api/calendar/admin/schedule',
  )
  return entries
}

export async function createAdminCalendarSchedule(data: {
  eventTypeId: string
  startDate: string
  endDate: string
  registrationDays?: number
  rewardDays?: number
}): Promise<SiteEventScheduleEntry> {
  const { entry } = await request<{ entry: SiteEventScheduleEntry }>(
    '/api/calendar/admin/schedule',
    { method: 'POST', body: JSON.stringify(data) },
  )
  return entry
}

export async function updateAdminCalendarSchedule(
  id: string,
  data: {
    eventTypeId?: string
    startDate?: string
    endDate?: string
    registrationDays?: number
    rewardDays?: number
  },
): Promise<SiteEventScheduleEntry> {
  const { entry } = await request<{ entry: SiteEventScheduleEntry }>(
    `/api/calendar/admin/schedule/${encodeURIComponent(id)}`,
    { method: 'PUT', body: JSON.stringify(data) },
  )
  return entry
}

export async function deleteAdminCalendarSchedule(id: string): Promise<void> {
  await request(`/api/calendar/admin/schedule/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export type SiteCalendarSettings = {
  upcomingLimit: number
}

export async function getCalendarSettings(): Promise<SiteCalendarSettings> {
  const { settings } = await request<{ settings: SiteCalendarSettings }>('/api/calendar/settings')
  return settings
}

export async function getAdminCalendarSettings(): Promise<SiteCalendarSettings> {
  const { settings } = await request<{ settings: SiteCalendarSettings }>(
    '/api/calendar/admin/settings',
  )
  return settings
}

export async function updateAdminCalendarSettings(data: {
  upcomingLimit: number
}): Promise<SiteCalendarSettings> {
  const { settings } = await request<{ settings: SiteCalendarSettings }>(
    '/api/calendar/admin/settings',
    { method: 'PUT', body: JSON.stringify(data) },
  )
  return settings
}

