import { Hono } from 'hono'
import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import { cozyFarmListings, cozyFarmVotes, users } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import type { AppVariables } from '../middleware/session.js'

const uuidSchema = z.string().uuid()

const bonusField = z
  .number()
  .min(0)
  .max(999)
  .nullable()
  .optional()

const listingBodySchema = z
  .object({
    gameUid: z.string().trim().min(1).max(64),
    bonusDragonfruit: bonusField,
    bonusCarrot: bonusField,
    bonusBamboo: bonusField,
    bonusPhantom: bonusField,
    bonusCranberry: bonusField,
    bonusOrange: bonusField,
  })
  .superRefine((data, ctx) => {
    const bonuses = [
      data.bonusDragonfruit,
      data.bonusCarrot,
      data.bonusBamboo,
      data.bonusPhantom,
      data.bonusCranberry,
      data.bonusOrange,
    ]
    const hasBonus = bonuses.some((b) => b != null)
    if (!hasBonus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one fruit bonus is required',
      })
    }
  })

const voteBodySchema = z.object({
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
})

function nullIfUndefined(v: number | null | undefined): number | null {
  return v === undefined ? null : v
}

function maxBonus(row: {
  bonusDragonfruit: number | null
  bonusCarrot: number | null
  bonusBamboo: number | null
  bonusPhantom: number | null
  bonusCranberry: number | null
  bonusOrange: number | null
}): number {
  return Math.max(
    row.bonusDragonfruit ?? 0,
    row.bonusCarrot ?? 0,
    row.bonusBamboo ?? 0,
    row.bonusPhantom ?? 0,
    row.bonusCranberry ?? 0,
    row.bonusOrange ?? 0,
  )
}

export function createCozyFarmRoutes(db: Db) {
  const app = new Hono<{ Variables: AppVariables }>()
  app.use('*', requireAuth)

  app.get('/listings', async (c) => {
    const me = c.get('user')!

    const rows = await db
      .select({
        id: cozyFarmListings.id,
        userId: cozyFarmListings.userId,
        username: users.username,
        gameUid: cozyFarmListings.gameUid,
        bonusDragonfruit: cozyFarmListings.bonusDragonfruit,
        bonusCarrot: cozyFarmListings.bonusCarrot,
        bonusBamboo: cozyFarmListings.bonusBamboo,
        bonusPhantom: cozyFarmListings.bonusPhantom,
        bonusCranberry: cozyFarmListings.bonusCranberry,
        bonusOrange: cozyFarmListings.bonusOrange,
        createdAt: cozyFarmListings.createdAt,
        updatedAt: cozyFarmListings.updatedAt,
        likes: sql<number>`coalesce(sum(case when ${cozyFarmVotes.value} = 1 then ${cozyFarmVotes.weight} else 0 end), 0)::int`,
        dislikes: sql<number>`coalesce(sum(case when ${cozyFarmVotes.value} = -1 then ${cozyFarmVotes.weight} else 0 end), 0)::int`,
      })
      .from(cozyFarmListings)
      .innerJoin(users, eq(cozyFarmListings.userId, users.id))
      .leftJoin(cozyFarmVotes, eq(cozyFarmVotes.listingId, cozyFarmListings.id))
      .groupBy(
        cozyFarmListings.id,
        cozyFarmListings.userId,
        users.username,
        cozyFarmListings.gameUid,
        cozyFarmListings.bonusDragonfruit,
        cozyFarmListings.bonusCarrot,
        cozyFarmListings.bonusBamboo,
        cozyFarmListings.bonusPhantom,
        cozyFarmListings.bonusCranberry,
        cozyFarmListings.bonusOrange,
        cozyFarmListings.createdAt,
        cozyFarmListings.updatedAt,
      )

    const myVotes = await db
      .select({
        listingId: cozyFarmVotes.listingId,
        value: cozyFarmVotes.value,
      })
      .from(cozyFarmVotes)
      .where(eq(cozyFarmVotes.voterUserId, me.id))

    const myVoteMap = new Map(myVotes.map((v) => [v.listingId, v.value as 1 | -1]))

    const listings = rows
      .map((row) => ({
        id: row.id,
        userId: row.userId,
        username: row.username,
        gameUid: row.gameUid,
        bonusDragonfruit: row.bonusDragonfruit,
        bonusCarrot: row.bonusCarrot,
        bonusBamboo: row.bonusBamboo,
        bonusPhantom: row.bonusPhantom,
        bonusCranberry: row.bonusCranberry,
        bonusOrange: row.bonusOrange,
        likes: Number(row.likes),
        dislikes: Number(row.dislikes),
        myVote: myVoteMap.get(row.id) ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        _maxBonus: maxBonus(row),
      }))
      .sort((a, b) => {
        if (b.likes !== a.likes) return b.likes - a.likes
        if (b._maxBonus !== a._maxBonus) return b._maxBonus - a._maxBonus
        return b.updatedAt.localeCompare(a.updatedAt)
      })
      .map(({ _maxBonus: _, ...rest }) => rest)

    return c.json({ listings })
  })

  app.post('/listings', async (c) => {
    const me = c.get('user')!
    const body = await c.req.json().catch(() => null)
    const parsed = listingBodySchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const data = parsed.data
    const [created] = await db
      .insert(cozyFarmListings)
      .values({
        userId: me.id,
        gameUid: data.gameUid,
        bonusDragonfruit: nullIfUndefined(data.bonusDragonfruit),
        bonusCarrot: nullIfUndefined(data.bonusCarrot),
        bonusBamboo: nullIfUndefined(data.bonusBamboo),
        bonusPhantom: nullIfUndefined(data.bonusPhantom),
        bonusCranberry: nullIfUndefined(data.bonusCranberry),
        bonusOrange: nullIfUndefined(data.bonusOrange),
      })
      .returning()

    return c.json({ listing: created }, 201)
  })

  app.put('/listings/:id', async (c) => {
    const me = c.get('user')!
    const listingId = c.req.param('id')
    if (!uuidSchema.safeParse(listingId).success) {
      return c.json({ error: 'Invalid listing ID' }, 400)
    }

    const body = await c.req.json().catch(() => null)
    const parsed = listingBodySchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const [existing] = await db
      .select({ id: cozyFarmListings.id, userId: cozyFarmListings.userId })
      .from(cozyFarmListings)
      .where(eq(cozyFarmListings.id, listingId))
      .limit(1)

    if (!existing) return c.json({ error: 'Listing not found' }, 404)
    const isAdmin = me.permissions.includes('admin:access')
    if (existing.userId !== me.id && !isAdmin) return c.json({ error: 'Forbidden' }, 403)

    const data = parsed.data
    const [updated] = await db
      .update(cozyFarmListings)
      .set({
        gameUid: data.gameUid,
        bonusDragonfruit: nullIfUndefined(data.bonusDragonfruit),
        bonusCarrot: nullIfUndefined(data.bonusCarrot),
        bonusBamboo: nullIfUndefined(data.bonusBamboo),
        bonusPhantom: nullIfUndefined(data.bonusPhantom),
        bonusCranberry: nullIfUndefined(data.bonusCranberry),
        bonusOrange: nullIfUndefined(data.bonusOrange),
        updatedAt: new Date(),
      })
      .where(eq(cozyFarmListings.id, listingId))
      .returning()

    return c.json({ listing: updated })
  })

  app.delete('/listings/:id', async (c) => {
    const me = c.get('user')!
    const listingId = c.req.param('id')
    if (!uuidSchema.safeParse(listingId).success) {
      return c.json({ error: 'Invalid listing ID' }, 400)
    }

    const [existing] = await db
      .select({ id: cozyFarmListings.id, userId: cozyFarmListings.userId })
      .from(cozyFarmListings)
      .where(eq(cozyFarmListings.id, listingId))
      .limit(1)

    if (!existing) return c.json({ error: 'Listing not found' }, 404)
    const isAdmin = me.permissions.includes('admin:access')
    if (existing.userId !== me.id && !isAdmin) return c.json({ error: 'Forbidden' }, 403)

    await db.delete(cozyFarmListings).where(eq(cozyFarmListings.id, listingId))
    return c.json({ ok: true })
  })

  app.post('/listings/:id/vote', async (c) => {
    const me = c.get('user')!
    // Seeded only on superadmin; used as privilege gate for self-vote + stacked reacts.
    const isSuperadmin = me.permissions.includes('roles:manage')
    const listingId = c.req.param('id')
    if (!uuidSchema.safeParse(listingId).success) {
      return c.json({ error: 'Invalid listing ID' }, 400)
    }

    const body = await c.req.json().catch(() => null)
    const parsed = voteBodySchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const [listing] = await db
      .select({ id: cozyFarmListings.id, userId: cozyFarmListings.userId })
      .from(cozyFarmListings)
      .where(eq(cozyFarmListings.id, listingId))
      .limit(1)

    if (!listing) return c.json({ error: 'Listing not found' }, 404)
    if (listing.userId === me.id && !isSuperadmin) {
      return c.json({ error: 'Cannot vote on your own listing' }, 400)
    }

    const nextValue = parsed.data.value

    if (nextValue === 0) {
      await db
        .delete(cozyFarmVotes)
        .where(
          and(eq(cozyFarmVotes.listingId, listingId), eq(cozyFarmVotes.voterUserId, me.id)),
        )
      return c.json({ ok: true, myVote: null })
    }

    const [existingVote] = await db
      .select({ value: cozyFarmVotes.value, weight: cozyFarmVotes.weight })
      .from(cozyFarmVotes)
      .where(
        and(eq(cozyFarmVotes.listingId, listingId), eq(cozyFarmVotes.voterUserId, me.id)),
      )
      .limit(1)

    if (isSuperadmin) {
      if (existingVote?.value === nextValue) {
        await db
          .update(cozyFarmVotes)
          .set({ weight: existingVote.weight + 1 })
          .where(
            and(eq(cozyFarmVotes.listingId, listingId), eq(cozyFarmVotes.voterUserId, me.id)),
          )
      } else if (existingVote) {
        await db
          .update(cozyFarmVotes)
          .set({ value: nextValue, weight: 1 })
          .where(
            and(eq(cozyFarmVotes.listingId, listingId), eq(cozyFarmVotes.voterUserId, me.id)),
          )
      } else {
        await db.insert(cozyFarmVotes).values({
          listingId,
          voterUserId: me.id,
          value: nextValue,
          weight: 1,
        })
      }
      return c.json({ ok: true, myVote: nextValue })
    }

    // Toggle off if same vote again
    if (existingVote?.value === nextValue) {
      await db
        .delete(cozyFarmVotes)
        .where(
          and(eq(cozyFarmVotes.listingId, listingId), eq(cozyFarmVotes.voterUserId, me.id)),
        )
      return c.json({ ok: true, myVote: null })
    }

    if (existingVote) {
      await db
        .update(cozyFarmVotes)
        .set({ value: nextValue, weight: 1 })
        .where(
          and(eq(cozyFarmVotes.listingId, listingId), eq(cozyFarmVotes.voterUserId, me.id)),
        )
    } else {
      await db.insert(cozyFarmVotes).values({
        listingId,
        voterUserId: me.id,
        value: nextValue,
        weight: 1,
      })
    }

    return c.json({ ok: true, myVote: nextValue })
  })

  return app
}
