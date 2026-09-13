import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '../db/index.js'
import {
  cardTradeProfileStates,
  cozyFarmListings,
  profileClaims,
  profileMembers,
  profileStates,
  profiles,
  users,
} from '../db/schema.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import type { AppVariables } from '../middleware/session.js'
import { createRateLimit } from '../middleware/rateLimit.js'
import {
  listUserProfiles,
  publicProfile,
  requireProfileAccess,
  resolveActiveProfile,
  scrubPersonalStateData,
} from '../lib/profiles.js'
import {
  CLAIM_SCREENSHOT_MAX_BYTES,
  isAllowedClaimMime,
  saveClaimScreenshot,
} from '../lib/claimScreenshots.js'

/** Same rules as former users.uid. */
export const gameUidSchema = z
  .string()
  .trim()
  .min(1, 'UID is required')
  .max(64, 'UID must be at most 64 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'UID may only contain letters, numbers, _ and -')

const nicknameSchema = z
  .string()
  .trim()
  .min(1, 'Nickname is required')
  .max(64, 'Nickname must be at most 64 characters')

const createSchema = z.object({
  gameUid: gameUidSchema,
  nickname: nicknameSchema,
})

const patchSchema = z.object({
  nickname: nicknameSchema,
})

const addAdminSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/),
})

const activeSchema = z.object({
  profileId: z.string().uuid(),
})

const resolveClaimSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

export function createProfilesRoutes(db: Db, env: { TRUST_PROXY?: boolean }) {
  const app = new Hono<{ Variables: AppVariables }>()
  const rateLimit = createRateLimit(20, 60_000, { trustProxy: Boolean(env.TRUST_PROXY) })
  const claimLimit = createRateLimit(5, 60 * 60_000, { trustProxy: Boolean(env.TRUST_PROXY) })

  app.use('*', requireAuth)

  app.get('/', async (c) => {
    const user = c.get('user')!
    const rows = await listUserProfiles(db, user.id)
    const [u] = await db
      .select({ activeProfileId: users.activeProfileId })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    return c.json({
      profiles: rows.map((p) => publicProfile(p)),
      activeProfileId: u?.activeProfileId ?? null,
    })
  })

  app.put('/active', rateLimit, async (c) => {
    const user = c.get('user')!
    const body = await c.req.json().catch(() => null)
    const parsed = activeSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const access = await requireProfileAccess(db, parsed.data.profileId, user.id, 'admin')
    if (!access) {
      return c.json({ error: 'Profile not found' }, 404)
    }

    await db
      .update(users)
      .set({ activeProfileId: access.id })
      .where(eq(users.id, user.id))

    return c.json({ activeProfileId: access.id, profile: publicProfile(access) })
  })

  // Site-admin claim queue (must be before /:id)
  app.get('/claims/queue', requirePermission('admin:access'), async (c) => {
    const rows = await db
      .select({
        id: profileClaims.id,
        profileId: profileClaims.profileId,
        gameUid: profiles.gameUid,
        nickname: profiles.nickname,
        claimantUserId: profileClaims.claimantUserId,
        claimantUsername: users.username,
        screenshotPath: profileClaims.screenshotPath,
        message: profileClaims.message,
        status: profileClaims.status,
        createdAt: profileClaims.createdAt,
        ownerUserId: profiles.ownerUserId,
      })
      .from(profileClaims)
      .innerJoin(profiles, eq(profiles.id, profileClaims.profileId))
      .innerJoin(users, eq(users.id, profileClaims.claimantUserId))
      .where(eq(profileClaims.status, 'pending'))
      .orderBy(desc(profileClaims.createdAt))

    return c.json({
      claims: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  })

  app.post(
    '/claims/:claimId/resolve',
    requirePermission('admin:access'),
    rateLimit,
    async (c) => {
      const admin = c.get('user')!
      const claimId = c.req.param('claimId')
      const body = await c.req.json().catch(() => null)
      const parsed = resolveClaimSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Invalid input' }, 400)
      }

      const [claim] = await db
        .select()
        .from(profileClaims)
        .where(and(eq(profileClaims.id, claimId), eq(profileClaims.status, 'pending')))
        .limit(1)

      if (!claim) return c.json({ error: 'Claim not found' }, 404)

      if (parsed.data.action === 'reject') {
        await db
          .update(profileClaims)
          .set({
            status: 'rejected',
            resolvedAt: new Date(),
            resolvedByUserId: admin.id,
          })
          .where(eq(profileClaims.id, claimId))
        return c.json({ ok: true, status: 'rejected' })
      }

      await db.delete(profileMembers).where(eq(profileMembers.profileId, claim.profileId))
      await db
        .update(profiles)
        .set({ ownerUserId: claim.claimantUserId, deletedAt: null })
        .where(eq(profiles.id, claim.profileId))
      await db.insert(profileMembers).values({
        profileId: claim.profileId,
        userId: claim.claimantUserId,
        role: 'owner',
      })
      await db
        .update(users)
        .set({ activeProfileId: claim.profileId })
        .where(eq(users.id, claim.claimantUserId))

      const stuck = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.activeProfileId, claim.profileId))
      for (const row of stuck) {
        if (row.id !== claim.claimantUserId) {
          await db.update(users).set({ activeProfileId: null }).where(eq(users.id, row.id))
        }
      }

      await db
        .update(profileClaims)
        .set({
          status: 'approved',
          resolvedAt: new Date(),
          resolvedByUserId: admin.id,
        })
        .where(eq(profileClaims.id, claimId))

      return c.json({ ok: true, status: 'approved' })
    },
  )

  app.post('/', rateLimit, async (c) => {
    const user = c.get('user')!
    const body = await c.req.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const { gameUid, nickname } = parsed.data
    const existing = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.gameUid, gameUid))
      .limit(1)

    if (existing[0]) {
      return c.json(
        {
          error: 'This game UID is already linked to a profile',
          claimable: true,
          profileId: existing[0].id,
        },
        409,
      )
    }

    const [profile] = await db
      .insert(profiles)
      .values({
        gameUid,
        nickname,
        ownerUserId: user.id,
      })
      .returning()

    if (!profile) {
      return c.json({ error: 'Failed to create profile' }, 500)
    }

    await db.insert(profileMembers).values({
      profileId: profile.id,
      userId: user.id,
      role: 'owner',
    })

    const [u] = await db
      .select({ activeProfileId: users.activeProfileId })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    if (!u?.activeProfileId) {
      await db.update(users).set({ activeProfileId: profile.id }).where(eq(users.id, user.id))
    }

    return c.json(
      {
        profile: publicProfile({ ...profile, role: 'owner' }),
        activeProfileId: u?.activeProfileId ?? profile.id,
      },
      201,
    )
  })

  app.patch('/:id', rateLimit, async (c) => {
    const user = c.get('user')!
    const profileId = c.req.param('id')
    const access = await requireProfileAccess(db, profileId, user.id, 'admin')
    if (!access) return c.json({ error: 'Profile not found' }, 404)

    const body = await c.req.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const [updated] = await db
      .update(profiles)
      .set({ nickname: parsed.data.nickname })
      .where(eq(profiles.id, profileId))
      .returning()

    return c.json({
      profile: publicProfile({ ...updated!, role: access.role }),
    })
  })

  app.delete('/:id', rateLimit, async (c) => {
    const user = c.get('user')!
    const profileId = c.req.param('id')
    const access = await requireProfileAccess(db, profileId, user.id, 'owner')
    if (!access) return c.json({ error: 'Profile not found' }, 404)

    const now = new Date()

    await db.transaction(async (tx) => {
      await tx.update(profiles).set({ deletedAt: now }).where(eq(profiles.id, profileId))
      await tx.delete(profileMembers).where(eq(profileMembers.profileId, profileId))
      await tx
        .update(users)
        .set({ activeProfileId: null })
        .where(eq(users.activeProfileId, profileId))

      const eventStates = await tx
        .select({
          profileId: cardTradeProfileStates.profileId,
          eventId: cardTradeProfileStates.eventId,
          data: cardTradeProfileStates.data,
        })
        .from(cardTradeProfileStates)
        .where(eq(cardTradeProfileStates.profileId, profileId))

      for (const row of eventStates) {
        await tx
          .update(cardTradeProfileStates)
          .set({
            data: scrubPersonalStateData(row.data) as unknown as (typeof row)['data'],
            shareEnabled: false,
            shareSlug: null,
            updatedAt: now,
            updatedByUserId: user.id,
          })
          .where(
            and(
              eq(cardTradeProfileStates.profileId, row.profileId),
              eq(cardTradeProfileStates.eventId, row.eventId),
            ),
          )
      }

      const legacy = await tx
        .select({ data: profileStates.data })
        .from(profileStates)
        .where(eq(profileStates.profileId, profileId))
        .limit(1)

      if (legacy[0]) {
        await tx
          .update(profileStates)
          .set({
            data: scrubPersonalStateData(legacy[0].data) as unknown as (typeof legacy)[number]['data'],
            shareEnabled: false,
            shareSlug: null,
            updatedAt: now,
            updatedByUserId: user.id,
          })
          .where(eq(profileStates.profileId, profileId))
      }

      await tx.delete(cozyFarmListings).where(eq(cozyFarmListings.profileId, profileId))
    })

    const next = await resolveActiveProfile(db, user.id, null)
    return c.json({ ok: true, activeProfileId: next?.id ?? null })
  })

  app.get('/:id/admins', async (c) => {
    const user = c.get('user')!
    const profileId = c.req.param('id')
    const access = await requireProfileAccess(db, profileId, user.id, 'admin')
    if (!access) return c.json({ error: 'Profile not found' }, 404)

    const rows = await db
      .select({
        userId: profileMembers.userId,
        role: profileMembers.role,
        username: users.username,
      })
      .from(profileMembers)
      .innerJoin(users, eq(users.id, profileMembers.userId))
      .where(eq(profileMembers.profileId, profileId))

    return c.json({
      members: rows.map((r) => ({
        userId: r.userId,
        username: r.username,
        role: r.role,
      })),
    })
  })

  app.post('/:id/admins', rateLimit, async (c) => {
    const user = c.get('user')!
    const profileId = c.req.param('id')
    const access = await requireProfileAccess(db, profileId, user.id, 'owner')
    if (!access) return c.json({ error: 'Profile not found' }, 404)

    const body = await c.req.json().catch(() => null)
    const parsed = addAdminSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const [target] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.username, parsed.data.username))
      .limit(1)

    if (!target) {
      return c.json({ error: 'User not found' }, 404)
    }
    if (target.id === user.id) {
      return c.json({ error: 'Owner is already a member' }, 400)
    }

    const existing = await db
      .select({ role: profileMembers.role })
      .from(profileMembers)
      .where(
        and(eq(profileMembers.profileId, profileId), eq(profileMembers.userId, target.id)),
      )
      .limit(1)

    if (existing[0]) {
      return c.json({ error: 'User is already a member' }, 409)
    }

    await db.insert(profileMembers).values({
      profileId,
      userId: target.id,
      role: 'admin',
    })

    return c.json({
      member: { userId: target.id, username: target.username, role: 'admin' },
    }, 201)
  })

  app.delete('/:id/admins/:userId', rateLimit, async (c) => {
    const user = c.get('user')!
    const profileId = c.req.param('id')
    const targetUserId = c.req.param('userId')

    const access = await requireProfileAccess(db, profileId, user.id, 'admin')
    if (!access) return c.json({ error: 'Profile not found' }, 404)

    const isSelfLeave = targetUserId === user.id
    if (!isSelfLeave && access.role !== 'owner') {
      return c.json({ error: 'Only the owner can remove admins' }, 403)
    }

    const [member] = await db
      .select({ role: profileMembers.role })
      .from(profileMembers)
      .where(
        and(eq(profileMembers.profileId, profileId), eq(profileMembers.userId, targetUserId)),
      )
      .limit(1)

    if (!member) return c.json({ error: 'Member not found' }, 404)
    if (member.role === 'owner') {
      return c.json({ error: 'Cannot remove the owner' }, 400)
    }

    await db
      .delete(profileMembers)
      .where(
        and(eq(profileMembers.profileId, profileId), eq(profileMembers.userId, targetUserId)),
      )

    if (isSelfLeave) {
      const [u] = await db
        .select({ activeProfileId: users.activeProfileId })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1)
      if (u?.activeProfileId === profileId) {
        await resolveActiveProfile(db, user.id, null)
      }
    }

    return c.json({ ok: true })
  })

  app.post('/:id/claims', claimLimit, async (c) => {
    const user = c.get('user')!
    const profileId = c.req.param('id')

    const [profile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1)
    if (!profile) return c.json({ error: 'Profile not found' }, 404)

    const membership = await requireProfileAccess(db, profileId, user.id, 'admin')
    if (membership) {
      return c.json({ error: 'You already have access to this profile' }, 400)
    }

    const pending = await db
      .select({ id: profileClaims.id })
      .from(profileClaims)
      .where(
        and(
          eq(profileClaims.profileId, profileId),
          eq(profileClaims.claimantUserId, user.id),
          eq(profileClaims.status, 'pending'),
        ),
      )
      .limit(1)
    if (pending[0]) {
      return c.json({ error: 'You already have a pending claim' }, 409)
    }

    const body = await c.req.parseBody({ all: true })
    const raw = body['screenshot']
    const file = Array.isArray(raw) ? raw[0] : raw
    const messageRaw = body['message']
    const message =
      typeof messageRaw === 'string' ? messageRaw.trim().slice(0, 1000) : null

    if (!(file instanceof File)) {
      return c.json({ error: 'Screenshot is required' }, 400)
    }
    if (!isAllowedClaimMime(file.type)) {
      return c.json({ error: 'Only JPEG, PNG, WebP and GIF are allowed' }, 400)
    }
    if (file.size <= 0 || file.size > CLAIM_SCREENSHOT_MAX_BYTES) {
      return c.json({ error: 'Screenshot must be under 5 MB' }, 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let screenshotPath: string
    try {
      const saved = await saveClaimScreenshot(file.type, buffer)
      screenshotPath = saved.publicUrl
    } catch {
      return c.json({ error: 'Invalid screenshot file' }, 400)
    }

    const [claim] = await db
      .insert(profileClaims)
      .values({
        profileId,
        claimantUserId: user.id,
        screenshotPath,
        message,
        status: 'pending',
      })
      .returning({ id: profileClaims.id, status: profileClaims.status })

    return c.json({ claim }, 201)
  })

  return app
}
