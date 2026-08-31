import type { Account, AppState } from '../types'

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
}

export type PublicCollectionSummary = {
  slug: string
  username: string
  updatedAt: string
  stats: {
    uniqueOwned: number
    neededCount: number
  }
}

export type ShareSettings = {
  enabled: boolean
  slug: string
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
}

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
