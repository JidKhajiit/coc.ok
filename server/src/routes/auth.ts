import { Hono } from 'hono'
import { z } from 'zod'
import { hash, verify } from '@node-rs/argon2'
import { and, eq } from 'drizzle-orm'
import { getCookie } from 'hono/cookie'
import type { Db } from '../db/index.js'
import { authTokens, userStates, users, userRoles, roles, rolePermissions, permissions } from '../db/schema.js'
import type { Env } from '../env.js'
import { passwordResetEmail, verificationEmail } from '../lib/email.js'
import {
  authTokenExpiry,
  generateAuthToken,
  hashAuthToken,
  normalizeEmail,
} from '../lib/tokens.js'
import {
  createSession,
  destroySession,
  destroyUserSessions,
  SESSION_COOKIE,
  type AppVariables,
} from '../middleware/session.js'
import { createRateLimit } from '../middleware/rateLimit.js'
import { requireAuth } from '../middleware/auth.js'
import { EMPTY_STATE } from '../../../shared/types.js'

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be at most 32 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, _ and -')

const emailSchema = z.string().trim().email('Invalid email address').max(254)

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128)

const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
})

const loginSchema = z.object({
  login: z.string().trim().min(1, 'Enter email or username').max(254),
  password: passwordSchema,
})

const forgotSchema = z.object({
  email: emailSchema,
})

const resetSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

const verifySchema = z.object({
  token: z.string().min(1),
})

async function createAuthToken(
  db: Db,
  userId: string,
  type: 'email_verify' | 'password_reset',
) {
  const { token, hash: tokenHash } = generateAuthToken()
  await db.insert(authTokens).values({
    userId,
    type,
    tokenHash,
    expiresAt: authTokenExpiry(type),
  })
  return token
}

async function consumeAuthToken(db: Db, token: string, type: 'email_verify' | 'password_reset') {
  const tokenHash = hashAuthToken(token)
  const rows = await db
    .select({
      id: authTokens.id,
      userId: authTokens.userId,
      expiresAt: authTokens.expiresAt,
    })
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.type, type)))
    .limit(1)

  const row = rows[0]
  if (!row || row.expiresAt < new Date()) {
    if (row) await db.delete(authTokens).where(eq(authTokens.id, row.id))
    return null
  }

  await db.delete(authTokens).where(eq(authTokens.id, row.id))
  return row.userId
}

export function createAuthRoutes(db: Db, env: Env) {
  const app = new Hono<{ Variables: AppVariables }>()
  const rateLimit = createRateLimit(10, 60_000, { trustProxy: env.TRUST_PROXY })

  app.post('/register', rateLimit, async (c) => {
    if (!env.ALLOW_REGISTRATION) {
      return c.json({ error: 'Registration is disabled' }, 403)
    }

    const body = await c.req.json().catch(() => null)
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const { username, password } = parsed.data
    const email = normalizeEmail(parsed.data.email)

    const existingUsername = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1)
    const existingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    if (existingUsername.length > 0 || existingEmail.length > 0) {
      // Same response for username/email conflict to avoid account enumeration.
      return c.json({ error: 'Unable to register with these credentials' }, 409)
    }

    const [userRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, 'user')).limit(1)
    if (!userRole) {
      return c.json({ error: 'Server misconfigured: default role missing' }, 500)
    }

    const passwordHash = await hash(password)
    const [user] = await db
      .insert(users)
      .values({ username, email, emailVerified: false, passwordHash })
      .returning({ id: users.id, username: users.username })

    if (!user) {
      return c.json({ error: 'Failed to create user' }, 500)
    }

    await db.insert(userStates).values({ userId: user.id, data: EMPTY_STATE })
    await db.insert(userRoles).values({ userId: user.id, roleId: userRole.id })

    try {
      const token = await createAuthToken(db, user.id, 'email_verify')
      await verificationEmail(env, email, token)
    } catch (err) {
      console.error('Verification email failed:', err)
      // Account created; do not leak SMTP/identity details.
    }

    return c.json({
      message: 'Verification email sent',
      needsVerification: true,
    }, 201)
  })

  app.post('/login', rateLimit, async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const { login, password } = parsed.data
    const loginValue = login.includes('@') ? normalizeEmail(login) : login

    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        passwordHash: users.passwordHash,
        email: users.email,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(
        login.includes('@')
          ? eq(users.email, loginValue)
          : eq(users.username, loginValue),
      )
      .limit(1)

    const user = rows[0]
    if (!user || !(await verify(user.passwordHash, password))) {
      return c.json({ error: 'Invalid email/username or password' }, 401)
    }

    if (user.email && !user.emailVerified) {
      return c.json({ error: 'Email not verified. Check your inbox.' }, 403)
    }

    await createSession(db, env, c, user.id)

    const permRows = await db
      .selectDistinct({ name: permissions.name })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, user.id))

    return c.json({
      user: {
        id: user.id,
        username: user.username,
        permissions: permRows.map((p) => p.name),
      },
    })
  })

  app.post('/verify-email', rateLimit, async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid token' }, 400)
    }

    const userId = await consumeAuthToken(db, parsed.data.token, 'email_verify')
    if (!userId) {
      return c.json({ error: 'Invalid or expired token' }, 400)
    }

    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, userId))

    return c.json({ ok: true })
  })

  app.post('/forgot-password', rateLimit, async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = forgotSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const email = normalizeEmail(parsed.data.email)
    const rows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    const user = rows[0]
    if (user?.email) {
      try {
        const token = await createAuthToken(db, user.id, 'password_reset')
        await passwordResetEmail(env, user.email, token)
      } catch (err) {
        console.error('Password reset email failed:', err)
      }
    }

    return c.json({
      message: 'If this email is registered, a reset link has been sent',
    })
  })

  app.post('/reset-password', rateLimit, async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = resetSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const userId = await consumeAuthToken(db, parsed.data.token, 'password_reset')
    if (!userId) {
      return c.json({ error: 'Invalid or expired token' }, 400)
    }

    const passwordHash = await hash(parsed.data.password)
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
    await destroyUserSessions(db, userId)
    // Invalidate unused password-reset tokens for this user
    await db
      .delete(authTokens)
      .where(and(eq(authTokens.userId, userId), eq(authTokens.type, 'password_reset')))

    return c.json({ ok: true })
  })

  app.post('/resend-verification', rateLimit, async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = forgotSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const email = normalizeEmail(parsed.data.email)
    const rows = await db
      .select({ id: users.id, email: users.email, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    const user = rows[0]
    if (user?.email && !user.emailVerified) {
      try {
        const token = await createAuthToken(db, user.id, 'email_verify')
        await verificationEmail(env, user.email, token)
      } catch (err) {
        console.error('Resend verification email failed:', err)
      }
    }

    return c.json({ message: 'If this email is pending verification, a new link has been sent' })
  })

  app.post('/logout', requireAuth, async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE)
    await destroySession(db, env, c, sessionId)
    return c.json({ ok: true })
  })

  app.get('/me', async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ user: null })
    }
    return c.json({
      user: {
        id: user.id,
        username: user.username,
        permissions: user.permissions,
      },
    })
  })

  return app
}
