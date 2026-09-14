import { Hono } from 'hono'
import { z } from 'zod'
import type { Db } from '../db/index.js'
import {
  createSiteEventScheduleEntry,
  createSiteEventType,
  deleteSiteEventScheduleEntry,
  deleteSiteEventType,
  isIsoDate,
  listSiteEventSchedule,
  listSiteEventTypes,
  updateSiteEventScheduleEntry,
  updateSiteEventType,
} from '../lib/calendar.js'
import { requirePermission } from '../middleware/auth.js'
import type { AppVariables } from '../middleware/session.js'

const uuidSchema = z.string().uuid()
const isoDateSchema = z.string().refine(isIsoDate, 'Invalid ISO date')
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug')

const createTypeSchema = z.object({
  slug: slugSchema,
  nameRu: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().min(1).max(200),
  path: z
    .string()
    .trim()
    .max(200)
    .regex(/^\/[A-Za-z0-9/_-]*$/, 'Path must start with /')
    .nullable()
    .optional(),
  color: z
    .string()
    .trim()
    .max(32)
    .regex(/^#[0-9A-Fa-f]{3,8}$/, 'Color must be a hex value')
    .nullable()
    .optional(),
})

const updateTypeSchema = z.object({
  nameRu: z.string().trim().min(1).max(200).optional(),
  nameEn: z.string().trim().min(1).max(200).optional(),
  path: z
    .string()
    .trim()
    .max(200)
    .regex(/^\/[A-Za-z0-9/_-]*$/, 'Path must start with /')
    .nullable()
    .optional(),
  color: z
    .string()
    .trim()
    .max(32)
    .regex(/^#[0-9A-Fa-f]{3,8}$/, 'Color must be a hex value')
    .nullable()
    .optional(),
})

const phaseFlagSchema = z.number().int().min(0).max(1)

const scheduleSchema = z
  .object({
    eventTypeId: uuidSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    registrationDays: phaseFlagSchema.default(0),
    rewardDays: phaseFlagSchema.default(0),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  })

const updateScheduleSchema = z
  .object({
    eventTypeId: uuidSchema.optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    registrationDays: phaseFlagSchema.optional(),
    rewardDays: phaseFlagSchema.optional(),
  })
  .refine(
    (v) => {
      if (v.startDate && v.endDate) return v.startDate <= v.endDate
      return true
    },
    { message: 'endDate must be on or after startDate', path: ['endDate'] },
  )

export function createCalendarRoutes(db: Db) {
  const app = new Hono<{ Variables: AppVariables }>()

  // Public: schedule for a date range (defaults to current month window)
  app.get('/schedule', async (c) => {
    const fromRaw = c.req.query('from')
    const toRaw = c.req.query('to')

    let range: { from: string; to: string } | undefined
    if (fromRaw || toRaw) {
      if (!fromRaw || !toRaw || !isIsoDate(fromRaw) || !isIsoDate(toRaw)) {
        return c.json({ error: 'from and to must be valid YYYY-MM-DD dates' }, 400)
      }
      if (fromRaw > toRaw) {
        return c.json({ error: 'from must be on or before to' }, 400)
      }
      range = { from: fromRaw, to: toRaw }
    }

    const entries = await listSiteEventSchedule(db, range)
    return c.json({ entries })
  })

  // Public: catalog of event types (for display / filters)
  app.get('/types', async (c) => {
    const types = await listSiteEventTypes(db)
    return c.json({ types })
  })

  // ── Admin ──────────────────────────────────────────────────────────────────

  app.get('/admin/types', requirePermission('calendar:manage'), async (c) => {
    const types = await listSiteEventTypes(db)
    return c.json({ types })
  })

  app.post('/admin/types', requirePermission('calendar:manage'), async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = createTypeSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    try {
      const type = await createSiteEventType(db, {
        slug: parsed.data.slug,
        nameRu: parsed.data.nameRu,
        nameEn: parsed.data.nameEn,
        path: parsed.data.path === undefined ? null : parsed.data.path,
        color: parsed.data.color === undefined ? null : parsed.data.color,
      })
      return c.json({ type }, 201)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('unique') || message.includes('duplicate')) {
        return c.json({ error: 'Slug already exists' }, 409)
      }
      console.error('createSiteEventType', err)
      return c.json({ error: 'Failed to create event type' }, 500)
    }
  })

  app.put('/admin/types/:id', requirePermission('calendar:manage'), async (c) => {
    const id = c.req.param('id')
    if (!uuidSchema.safeParse(id).success) {
      return c.json({ error: 'Invalid id' }, 400)
    }

    const body = await c.req.json().catch(() => null)
    const parsed = updateTypeSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const type = await updateSiteEventType(db, id, parsed.data)
    if (!type) return c.json({ error: 'Not found' }, 404)
    return c.json({ type })
  })

  app.delete('/admin/types/:id', requirePermission('calendar:manage'), async (c) => {
    const id = c.req.param('id')
    if (!uuidSchema.safeParse(id).success) {
      return c.json({ error: 'Invalid id' }, 400)
    }
    const ok = await deleteSiteEventType(db, id)
    if (!ok) return c.json({ error: 'Not found' }, 404)
    return c.json({ ok: true })
  })

  app.get('/admin/schedule', requirePermission('calendar:manage'), async (c) => {
    const entries = await listSiteEventSchedule(db)
    return c.json({ entries })
  })

  app.post('/admin/schedule', requirePermission('calendar:manage'), async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = scheduleSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const entry = await createSiteEventScheduleEntry(db, parsed.data)
    if (entry === 'invalid-phases') {
      return c.json(
        {
          error:
            'registration and reward flags must be 0 or 1 and fit within the event duration',
        },
        400,
      )
    }
    if (!entry) return c.json({ error: 'Event type not found' }, 404)
    return c.json({ entry }, 201)
  })

  app.put('/admin/schedule/:id', requirePermission('calendar:manage'), async (c) => {
    const id = c.req.param('id')
    if (!uuidSchema.safeParse(id).success) {
      return c.json({ error: 'Invalid id' }, 400)
    }

    const body = await c.req.json().catch(() => null)
    const parsed = updateScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const entry = await updateSiteEventScheduleEntry(db, id, parsed.data)
    if (entry === null) return c.json({ error: 'Not found' }, 404)
    if (entry === 'invalid-range') {
      return c.json({ error: 'endDate must be on or after startDate' }, 400)
    }
    if (entry === 'invalid-phases') {
      return c.json(
        {
          error:
            'registration and reward flags must be 0 or 1 and fit within the event duration',
        },
        400,
      )
    }
    if (entry === 'type-not-found') {
      return c.json({ error: 'Event type not found' }, 404)
    }

    return c.json({ entry })
  })

  app.delete('/admin/schedule/:id', requirePermission('calendar:manage'), async (c) => {
    const id = c.req.param('id')
    if (!uuidSchema.safeParse(id).success) {
      return c.json({ error: 'Invalid id' }, 400)
    }
    const ok = await deleteSiteEventScheduleEntry(db, id)
    if (!ok) return c.json({ error: 'Not found' }, 404)
    return c.json({ ok: true })
  })

  return app
}
