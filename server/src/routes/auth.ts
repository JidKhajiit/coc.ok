import { Hono } from 'hono'
import { z } from 'zod'
import { hash, verify } from '@node-rs/argon2'
import { and, eq, isNull } from 'drizzle-orm'
import { getCookie } from 'hono/cookie'
import type { Db } from '../db/index.js'
import {
  authTokens,
  userStates,
  users,
  userRoles,
  roles,
} from '../db/schema.js'
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
  destroyUserSessions,
  ensureDeviceAccountLink,
  ensureDeviceId,
  listDeviceAccounts,
  loadUserPermissions,
  logoutCurrentDeviceAccount,
  publicSessionUser,
  removeDeviceAccount,
  switchDeviceAccount,
  SESSION_COOKIE,
  type AppVariables,
} from '../middleware/session.js'
import { createRateLimit } from '../middleware/rateLimit.js'
import { requireAuth } from '../middleware/auth.js'
import { EMPTY_STATE } from '../../../shared/types.js'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isPasswordStrong,
} from '../../../shared/passwordPolicy.js'
import {
  AVATAR_MAX_BYTES,
  isAllowedAvatarMime,
  saveAvatarFile,
} from '../lib/avatars.js'

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be at most 32 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, _ and -')

/** Game UID used as the public share-link identity. */
export const uidSchema = z
  .string()
  .trim()
  .min(1, 'UID is required')
  .max(64, 'UID must be at most 64 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'UID may only contain letters, numbers, _ and -')

const emailSchema = z.string().trim().email('Invalid email address').max(254)

/** Login accepts existing passwords (length only). */
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH)

/** Register / reset require letters, digits, and special characters. */
const strongPasswordSchema = passwordSchema.refine(isPasswordStrong, {
  message:
    'Password must include letters, digits, and a special character (!@#$%^&*()_+-=[]{}|;:,.<>?)',
})

const registerSchema = z.object({
  username: usernameSchema,
  uid: uidSchema,
  email: emailSchema,
  password: strongPasswordSchema,
})

const setUidSchema = z.object({
  uid: uidSchema,
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
  password: strongPasswordSchema,
})

const verifySchema = z.object({
  token: z.string().min(1),
})

const switchSchema = z.object({
  userId: z.string().uuid(),
})

const removeAccountSchema = z.object({
  userId: z.string().uuid(),
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

    const { username, uid, password } = parsed.data
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
    const existingUid = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1)
    if (existingUsername.length > 0 || existingEmail.length > 0 || existingUid.length > 0) {
      // Same response for username/email/uid conflict to avoid account enumeration.
      return c.json({ error: 'Unable to register with these credentials' }, 409)
    }

    const [userRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, 'user')).limit(1)
    if (!userRole) {
      return c.json({ error: 'Server misconfigured: default role missing' }, 500)
    }

    const passwordHash = await hash(password)
    const [user] = await db
      .insert(users)
      .values({ username, uid, email, emailVerified: false, passwordHash })
      .returning({ id: users.id, username: users.username, uid: users.uid })

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
        uid: users.uid,
        avatarUrl: users.avatarUrl,
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

    try {
      await createSession(db, env, c, user.id)
    } catch (err) {
      if (err instanceof Error && err.message === 'DEVICE_ACCOUNT_LIMIT') {
        return c.json({ error: 'Too many accounts on this device (max 10)' }, 400)
      }
      throw err
    }

    const perms = await loadUserPermissions(db, user.id)
    const deviceId = ensureDeviceId(env, c)
    const accounts = await listDeviceAccounts(db, deviceId, user.id)

    return c.json({
      user: {
        id: user.id,
        username: user.username,
        uid: user.uid,
        avatarUrl: user.avatarUrl,
        permissions: perms,
      },
      accounts,
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
    const user = c.get('user')!
    const sessionId = getCookie(c, SESSION_COOKIE)
    const result = await logoutCurrentDeviceAccount(db, env, c, sessionId, user.id)
    return c.json({
      ok: true,
      user: result.user ? publicSessionUser(result.user) : null,
      accounts: result.accounts,
    })
  })

  app.get('/me', async (c) => {
    const user = c.get('user')
    const deviceId = ensureDeviceId(env, c)
    const sessionId = getCookie(c, SESSION_COOKIE)
    if (user && sessionId) {
      await ensureDeviceAccountLink(db, deviceId, user.id, sessionId)
    }
    const accounts = await listDeviceAccounts(db, deviceId, user?.id ?? null)
    if (!user) {
      return c.json({ user: null, accounts })
    }
    return c.json({
      user: publicSessionUser(user),
      accounts,
    })
  })

  app.get('/accounts', async (c) => {
    const user = c.get('user')
    const deviceId = ensureDeviceId(env, c)
    const accounts = await listDeviceAccounts(db, deviceId, user?.id ?? null)
    return c.json({ accounts })
  })

  app.post('/switch', rateLimit, async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = switchSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const deviceId = ensureDeviceId(env, c)
    const switched = await switchDeviceAccount(db, env, c, deviceId, parsed.data.userId)
    if (!switched) {
      return c.json({ error: 'Account not available on this device' }, 404)
    }

    const accounts = await listDeviceAccounts(db, deviceId, switched.id)
    return c.json({
      user: publicSessionUser(switched),
      accounts,
    })
  })

  app.post('/accounts/remove', requireAuth, rateLimit, async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = removeAccountSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const user = c.get('user')!
    const deviceId = ensureDeviceId(env, c)
    const result = await removeDeviceAccount(
      db,
      env,
      c,
      deviceId,
      parsed.data.userId,
      user.id,
    )

    if (!result.switched) {
      return c.json({
        user: publicSessionUser(user),
        accounts: result.accounts,
      })
    }

    return c.json({
      user: result.user ? publicSessionUser(result.user) : null,
      accounts: result.accounts,
    })
  })

  /** Set game UID once for legacy accounts that registered before UID was required. */
  app.put('/uid', requireAuth, async (c) => {
    const user = c.get('user')!
    if (user.uid) {
      return c.json({ error: 'UID is already set' }, 409)
    }

    const body = await c.req.json().catch(() => null)
    const parsed = setUidSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const uid = parsed.data.uid
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1)
    if (existing.length > 0) {
      return c.json({ error: 'This UID is already taken' }, 409)
    }

    const [updated] = await db
      .update(users)
      .set({ uid })
      .where(and(eq(users.id, user.id), isNull(users.uid)))
      .returning({
        id: users.id,
        username: users.username,
        uid: users.uid,
        avatarUrl: users.avatarUrl,
      })

    if (!updated?.uid) {
      return c.json({ error: 'UID is already set' }, 409)
    }

    return c.json({
      user: {
        id: updated.id,
        username: updated.username,
        uid: updated.uid,
        avatarUrl: updated.avatarUrl,
        permissions: user.permissions,
      },
    })
  })

  app.put('/avatar', requireAuth, rateLimit, async (c) => {
    const user = c.get('user')!
    const body = await c.req.parseBody({ all: true })
    const raw = body['avatar']
    const file = Array.isArray(raw) ? raw[0] : raw

    if (!(file instanceof File)) {
      return c.json({ error: 'Avatar file is required' }, 400)
    }

    const mime = file.type
    if (!isAllowedAvatarMime(mime)) {
      return c.json({ error: 'Only JPEG, PNG, WebP and GIF are allowed' }, 400)
    }

    if (file.size <= 0 || file.size > AVATAR_MAX_BYTES) {
      return c.json({ error: 'Avatar must be under 2 MB' }, 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let avatarUrl: string
    try {
      avatarUrl = await saveAvatarFile(user.id, mime, buffer, user.avatarUrl)
    } catch (err) {
      if (err instanceof Error && (err.message === 'INVALID_TYPE' || err.message === 'INVALID_SIZE')) {
        return c.json({ error: 'Invalid avatar file' }, 400)
      }
      throw err
    }

    await db.update(users).set({ avatarUrl }).where(eq(users.id, user.id))

    const deviceId = ensureDeviceId(env, c)
    const accounts = await listDeviceAccounts(db, deviceId, user.id)

    return c.json({
      user: {
        id: user.id,
        username: user.username,
        uid: user.uid,
        avatarUrl,
        permissions: user.permissions,
      },
      accounts,
    })
  })

  return app
}
