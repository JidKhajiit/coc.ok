import { createMiddleware } from 'hono/factory'
import type { Db } from '../db/index.js'
import { sessions, users, userRoles, rolePermissions, permissions } from '../db/schema.js'
import { eq, lt } from 'drizzle-orm'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Env } from '../env.js'

export const SESSION_COOKIE = 'session_id'
const SESSION_DAYS = 30

export type SessionUser = {
  id: string
  username: string
  permissions: string[]
}

export type AppVariables = {
  user: SessionUser | null
}

function sessionExpiry(): Date {
  const d = new Date()
  d.setDate(d.getDate() + SESSION_DAYS)
  return d
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
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.id, sessionId))
        .limit(1)

      const row = rows[0]
      if (row && row.expiresAt > new Date()) {
        // Load user permissions from roles
        const permRows = await db
          .selectDistinct({ name: permissions.name })
          .from(userRoles)
          .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(eq(userRoles.userId, row.userId))

        user = {
          id: row.userId,
          username: row.username,
          permissions: permRows.map((p) => p.name),
        }
      } else if (row) {
        await db.delete(sessions).where(eq(sessions.id, sessionId))
        deleteCookie(c, SESSION_COOKIE, cookieOptions(env, false))
      }
    }

    c.set('user', user)
    await next()
  })
}

export function cookieOptions(env: Env, httpOnly = true) {
  return {
    httpOnly,
    secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
    sameSite: 'Strict' as const,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  }
}

export async function createSession(
  db: Db,
  env: Env,
  c: { header: (name: string, value: string) => void },
  userId: string,
): Promise<string> {
  const id = crypto.randomUUID()
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt: sessionExpiry(),
  })
  setCookie(c as Parameters<typeof setCookie>[0], SESSION_COOKIE, id, cookieOptions(env))
  return id
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
  deleteCookie(c, SESSION_COOKIE, cookieOptions(env, false))
}

export async function cleanupExpiredSessions(db: Db) {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
}
