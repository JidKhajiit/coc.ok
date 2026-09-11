import { createMiddleware } from 'hono/factory'
import type { Db } from '../db/index.js'
import {
  deviceAccounts,
  sessions,
  users,
  userRoles,
  rolePermissions,
  permissions,
} from '../db/schema.js'
import { and, desc, eq, gt, lt } from 'drizzle-orm'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Env } from '../env.js'

export const SESSION_COOKIE = 'session_id'
export const DEVICE_COOKIE = 'device_id'
const SESSION_DAYS = 30
const DEVICE_DAYS = 365
const MAX_DEVICE_ACCOUNTS = 10

export type SessionUser = {
  id: string
  username: string
  activeProfileId: string | null
  avatarUrl: string | null
  permissions: string[]
}

export type DeviceAccountSummary = {
  id: string
  username: string
  avatarUrl: string | null
  active: boolean
}

export function publicSessionUser(user: SessionUser) {
  return {
    id: user.id,
    username: user.username,
    activeProfileId: user.activeProfileId,
    avatarUrl: user.avatarUrl,
    permissions: user.permissions,
  }
}

export type AppVariables = {
  user: SessionUser | null
}

type CookieContext = {
  header: (name: string, value: string) => void
}

function sessionExpiry(): Date {
  const d = new Date()
  d.setDate(d.getDate() + SESSION_DAYS)
  return d
}

export function cookieOptions(env: Env, httpOnly = true, maxAgeDays = SESSION_DAYS) {
  return {
    httpOnly,
    secure: Boolean(env.COOKIE_SECURE),
    sameSite: 'Strict' as const,
    path: '/',
    maxAge: maxAgeDays * 24 * 60 * 60,
  }
}

export function createSessionMiddleware(db: Db, env: Env) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const sessionId = getCookie(c, SESSION_COOKIE)
    let user: SessionUser | null = null

    if (sessionId) {
      const rows = await db
        .select({
          sessionId: sessions.id,
          userId: users.id,
          username: users.username,
          activeProfileId: users.activeProfileId,
          avatarUrl: users.avatarUrl,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.id, sessionId))
        .limit(1)

      const row = rows[0]
      if (row && row.expiresAt > new Date()) {
        const permRows = await db
          .selectDistinct({ name: permissions.name })
          .from(userRoles)
          .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(eq(userRoles.userId, row.userId))

        user = {
          id: row.userId,
          username: row.username,
          activeProfileId: row.activeProfileId,
          avatarUrl: row.avatarUrl,
          permissions: permRows.map((p) => p.name),
        }
      } else if (row) {
        await db.delete(sessions).where(eq(sessions.id, sessionId))
        deleteCookie(c, SESSION_COOKIE, cookieOptions(env))
      }
    }

    c.set('user', user)
    await next()
  })
}

export function ensureDeviceId(
  env: Env,
  c: CookieContext & { req: { header: (name: string) => string | undefined } },
): string {
  const existing = getCookie(c as Parameters<typeof getCookie>[0], DEVICE_COOKIE)
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
    // Refresh expiry while device is used.
    setCookie(
      c as Parameters<typeof setCookie>[0],
      DEVICE_COOKIE,
      existing,
      cookieOptions(env, true, DEVICE_DAYS),
    )
    return existing
  }
  const id = crypto.randomUUID()
  setCookie(c as Parameters<typeof setCookie>[0], DEVICE_COOKIE, id, cookieOptions(env, true, DEVICE_DAYS))
  return id
}

export async function loadUserPermissions(db: Db, userId: string): Promise<string[]> {
  const permRows = await db
    .selectDistinct({ name: permissions.name })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, userId))
  return permRows.map((p) => p.name)
}

export async function createSession(
  db: Db,
  env: Env,
  c: CookieContext & { req: { header: (name: string) => string | undefined } },
  userId: string,
): Promise<string> {
  const deviceId = ensureDeviceId(env, c)
  const id = crypto.randomUUID()
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt: sessionExpiry(),
  })

  const existing = await db
    .select({ sessionId: deviceAccounts.sessionId })
    .from(deviceAccounts)
    .where(and(eq(deviceAccounts.deviceId, deviceId), eq(deviceAccounts.userId, userId)))
    .limit(1)

  const oldSessionId = existing[0]?.sessionId

  if (existing[0]) {
    await db
      .update(deviceAccounts)
      .set({ sessionId: id, lastUsedAt: new Date() })
      .where(and(eq(deviceAccounts.deviceId, deviceId), eq(deviceAccounts.userId, userId)))
  } else {
    const countRows = await db
      .select({ userId: deviceAccounts.userId })
      .from(deviceAccounts)
      .where(eq(deviceAccounts.deviceId, deviceId))
    if (countRows.length >= MAX_DEVICE_ACCOUNTS) {
      await db.delete(sessions).where(eq(sessions.id, id))
      throw new Error('DEVICE_ACCOUNT_LIMIT')
    }
    await db.insert(deviceAccounts).values({
      deviceId,
      userId,
      sessionId: id,
      lastUsedAt: new Date(),
    })
  }

  if (oldSessionId && oldSessionId !== id) {
    await db.delete(sessions).where(eq(sessions.id, oldSessionId))
  }

  setCookie(c as Parameters<typeof setCookie>[0], SESSION_COOKIE, id, cookieOptions(env))
  return id
}

export async function ensureDeviceAccountLink(
  db: Db,
  deviceId: string,
  userId: string,
  sessionId: string,
) {
  const existing = await db
    .select({ sessionId: deviceAccounts.sessionId })
    .from(deviceAccounts)
    .where(and(eq(deviceAccounts.deviceId, deviceId), eq(deviceAccounts.userId, userId)))
    .limit(1)

  if (!existing[0]) {
    const countRows = await db
      .select({ userId: deviceAccounts.userId })
      .from(deviceAccounts)
      .where(eq(deviceAccounts.deviceId, deviceId))
    if (countRows.length >= MAX_DEVICE_ACCOUNTS) return
    await db.insert(deviceAccounts).values({
      deviceId,
      userId,
      sessionId,
      lastUsedAt: new Date(),
    })
    return
  }

  if (existing[0].sessionId !== sessionId) {
    await db
      .update(deviceAccounts)
      .set({ sessionId, lastUsedAt: new Date() })
      .where(and(eq(deviceAccounts.deviceId, deviceId), eq(deviceAccounts.userId, userId)))
  }
}

export async function listDeviceAccounts(
  db: Db,
  deviceId: string,
  activeUserId: string | null,
): Promise<DeviceAccountSummary[]> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      expiresAt: sessions.expiresAt,
      lastUsedAt: deviceAccounts.lastUsedAt,
    })
    .from(deviceAccounts)
    .innerJoin(sessions, eq(deviceAccounts.sessionId, sessions.id))
    .innerJoin(users, eq(deviceAccounts.userId, users.id))
    .where(and(eq(deviceAccounts.deviceId, deviceId), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(deviceAccounts.lastUsedAt))

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    avatarUrl: row.avatarUrl,
    active: activeUserId === row.id,
  }))
}

export async function switchDeviceAccount(
  db: Db,
  env: Env,
  c: CookieContext,
  deviceId: string,
  userId: string,
): Promise<SessionUser | null> {
  const rows = await db
    .select({
      sessionId: deviceAccounts.sessionId,
      userId: users.id,
      username: users.username,
      activeProfileId: users.activeProfileId,
      avatarUrl: users.avatarUrl,
      expiresAt: sessions.expiresAt,
    })
    .from(deviceAccounts)
    .innerJoin(sessions, eq(deviceAccounts.sessionId, sessions.id))
    .innerJoin(users, eq(deviceAccounts.userId, users.id))
    .where(and(eq(deviceAccounts.deviceId, deviceId), eq(deviceAccounts.userId, userId)))
    .limit(1)

  const row = rows[0]
  if (!row || row.expiresAt < new Date()) {
    if (row) {
      await db.delete(sessions).where(eq(sessions.id, row.sessionId))
    }
    return null
  }

  await db
    .update(deviceAccounts)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(deviceAccounts.deviceId, deviceId), eq(deviceAccounts.userId, userId)))

  setCookie(c as Parameters<typeof setCookie>[0], SESSION_COOKIE, row.sessionId, cookieOptions(env))

  return {
    id: row.userId,
    username: row.username,
    activeProfileId: row.activeProfileId,
    avatarUrl: row.avatarUrl,
    permissions: await loadUserPermissions(db, row.userId),
  }
}

export async function destroySession(
  db: Db,
  env: Env,
  c: Parameters<typeof deleteCookie>[0],
  sessionId: string | undefined,
) {
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
  }
  deleteCookie(c, SESSION_COOKIE, cookieOptions(env))
}

/** Log out current account on this device; activate another if present. */
export async function logoutCurrentDeviceAccount(
  db: Db,
  env: Env,
  c: CookieContext & { req: { header: (name: string) => string | undefined } },
  sessionId: string | undefined,
  activeUserId: string,
): Promise<{ user: SessionUser | null; accounts: DeviceAccountSummary[] }> {
  const deviceId = ensureDeviceId(env, c)
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
  }
  deleteCookie(c as Parameters<typeof deleteCookie>[0], SESSION_COOKIE, cookieOptions(env))

  const remaining = await listDeviceAccounts(db, deviceId, null)
  if (remaining.length === 0) {
    return { user: null, accounts: [] }
  }

  const next = remaining.find((a) => a.id !== activeUserId) ?? remaining[0]
  const switched = await switchDeviceAccount(db, env, c, deviceId, next.id)
  const accounts = await listDeviceAccounts(db, deviceId, switched?.id ?? null)
  return { user: switched, accounts }
}

export async function removeDeviceAccount(
  db: Db,
  env: Env,
  c: CookieContext & { req: { header: (name: string) => string | undefined } },
  deviceId: string,
  userId: string,
  activeUserId: string | null,
): Promise<{ user: SessionUser | null; accounts: DeviceAccountSummary[]; switched: boolean }> {
  const rows = await db
    .select({ sessionId: deviceAccounts.sessionId })
    .from(deviceAccounts)
    .where(and(eq(deviceAccounts.deviceId, deviceId), eq(deviceAccounts.userId, userId)))
    .limit(1)

  if (rows[0]) {
    await db.delete(sessions).where(eq(sessions.id, rows[0].sessionId))
  }

  if (activeUserId === userId) {
    deleteCookie(c as Parameters<typeof deleteCookie>[0], SESSION_COOKIE, cookieOptions(env))
    const remaining = await listDeviceAccounts(db, deviceId, null)
    if (remaining.length === 0) {
      return { user: null, accounts: [], switched: true }
    }
    const switched = await switchDeviceAccount(db, env, c, deviceId, remaining[0].id)
    const accounts = await listDeviceAccounts(db, deviceId, switched?.id ?? null)
    return { user: switched, accounts, switched: true }
  }

  const accounts = await listDeviceAccounts(db, deviceId, activeUserId)
  return { user: null, accounts, switched: false }
}

export async function destroyUserSessions(db: Db, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}

export async function cleanupExpiredSessions(db: Db) {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
}
