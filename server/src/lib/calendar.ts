import { and, asc, eq, gte, lte } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import { siteEventSchedule, siteEventTypes } from '../db/schema.js'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export type SiteEventType = {
  id: string
  slug: string
  nameRu: string
  nameEn: string
  path: string | null
  color: string | null
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
  }
}

export type SchedulePhaseInput = {
  startDate: string
  endDate: string
  registrationDays: number
  rewardDays: number
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}

export function inclusiveDayCount(startDate: string, endDate: string): number {
  const [ys, ms, ds] = startDate.split('-').map(Number)
  const [ye, me, de] = endDate.split('-').map(Number)
  const start = Date.UTC(ys, ms - 1, ds)
  const end = Date.UTC(ye, me - 1, de)
  return Math.round((end - start) / 86_400_000) + 1
}

export function areSchedulePhasesValid(input: SchedulePhaseInput): boolean {
  if (input.startDate > input.endDate) return false
  if (input.registrationDays < 0 || input.rewardDays < 0) return false
  if (input.registrationDays > 1 || input.rewardDays > 1) return false
  const total = inclusiveDayCount(input.startDate, input.endDate)
  return input.registrationDays + input.rewardDays <= total
}

function mapType(row: typeof siteEventTypes.$inferSelect): SiteEventType {
  return {
    id: row.id,
    slug: row.slug,
    nameRu: row.nameRu,
    nameEn: row.nameEn,
    path: row.path,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
  }
}

function mapScheduleEntry(
  row: {
    id: string
    eventTypeId: string
    startDate: string
    endDate: string
    registrationDays: number
    rewardDays: number
    createdAt: Date
    slug: string
    nameRu: string
    nameEn: string
    path: string | null
    color: string | null
  },
): SiteEventScheduleEntry {
  return {
    id: row.id,
    eventTypeId: row.eventTypeId,
    startDate: row.startDate,
    endDate: row.endDate,
    registrationDays: row.registrationDays,
    rewardDays: row.rewardDays,
    createdAt: row.createdAt.toISOString(),
    event: {
      slug: row.slug,
      nameRu: row.nameRu,
      nameEn: row.nameEn,
      path: row.path,
      color: row.color,
    },
  }
}

export async function listSiteEventTypes(db: Db): Promise<SiteEventType[]> {
  const rows = await db.select().from(siteEventTypes).orderBy(asc(siteEventTypes.nameRu))
  return rows.map(mapType)
}

export async function createSiteEventType(
  db: Db,
  input: {
    slug: string
    nameRu: string
    nameEn: string
    path?: string | null
    color?: string | null
  },
): Promise<SiteEventType> {
  const [row] = await db
    .insert(siteEventTypes)
    .values({
      slug: input.slug,
      nameRu: input.nameRu,
      nameEn: input.nameEn,
      path: input.path ?? null,
      color: input.color ?? null,
    })
    .returning()
  return mapType(row)
}

export async function updateSiteEventType(
  db: Db,
  id: string,
  input: {
    nameRu?: string
    nameEn?: string
    path?: string | null
    color?: string | null
  },
): Promise<SiteEventType | null> {
  const updates: Partial<typeof siteEventTypes.$inferInsert> = {}
  if (input.nameRu !== undefined) updates.nameRu = input.nameRu
  if (input.nameEn !== undefined) updates.nameEn = input.nameEn
  if (input.path !== undefined) updates.path = input.path
  if (input.color !== undefined) updates.color = input.color

  if (Object.keys(updates).length === 0) {
    const [existing] = await db.select().from(siteEventTypes).where(eq(siteEventTypes.id, id)).limit(1)
    return existing ? mapType(existing) : null
  }

  const [row] = await db
    .update(siteEventTypes)
    .set(updates)
    .where(eq(siteEventTypes.id, id))
    .returning()
  return row ? mapType(row) : null
}

export async function deleteSiteEventType(db: Db, id: string): Promise<boolean> {
  const deleted = await db.delete(siteEventTypes).where(eq(siteEventTypes.id, id)).returning({
    id: siteEventTypes.id,
  })
  return deleted.length > 0
}

async function selectScheduleJoined(db: Db, where?: ReturnType<typeof and>) {
  const query = db
    .select({
      id: siteEventSchedule.id,
      eventTypeId: siteEventSchedule.eventTypeId,
      startDate: siteEventSchedule.startDate,
      endDate: siteEventSchedule.endDate,
      registrationDays: siteEventSchedule.registrationDays,
      rewardDays: siteEventSchedule.rewardDays,
      createdAt: siteEventSchedule.createdAt,
      slug: siteEventTypes.slug,
      nameRu: siteEventTypes.nameRu,
      nameEn: siteEventTypes.nameEn,
      path: siteEventTypes.path,
      color: siteEventTypes.color,
    })
    .from(siteEventSchedule)
    .innerJoin(siteEventTypes, eq(siteEventSchedule.eventTypeId, siteEventTypes.id))
    .orderBy(asc(siteEventSchedule.startDate), asc(siteEventSchedule.endDate))

  if (where) {
    return query.where(where)
  }
  return query
}

export async function listSiteEventSchedule(
  db: Db,
  range?: { from: string; to: string },
): Promise<SiteEventScheduleEntry[]> {
  const where = range
    ? and(
        // overlaps [from, to]: start <= to AND end >= from
        lte(siteEventSchedule.startDate, range.to),
        gte(siteEventSchedule.endDate, range.from),
      )
    : undefined

  const rows = await selectScheduleJoined(db, where)
  return rows.map(mapScheduleEntry)
}

export async function createSiteEventScheduleEntry(
  db: Db,
  input: {
    eventTypeId: string
    startDate: string
    endDate: string
    registrationDays: number
    rewardDays: number
  },
): Promise<SiteEventScheduleEntry | null | 'invalid-phases'> {
  if (!areSchedulePhasesValid(input)) return 'invalid-phases'

  const [type] = await db
    .select()
    .from(siteEventTypes)
    .where(eq(siteEventTypes.id, input.eventTypeId))
    .limit(1)
  if (!type) return null

  const [row] = await db
    .insert(siteEventSchedule)
    .values({
      eventTypeId: input.eventTypeId,
      startDate: input.startDate,
      endDate: input.endDate,
      registrationDays: input.registrationDays,
      rewardDays: input.rewardDays,
    })
    .returning()

  return mapScheduleEntry({
    ...row,
    slug: type.slug,
    nameRu: type.nameRu,
    nameEn: type.nameEn,
    path: type.path,
    color: type.color,
  })
}

export async function updateSiteEventScheduleEntry(
  db: Db,
  id: string,
  input: {
    eventTypeId?: string
    startDate?: string
    endDate?: string
    registrationDays?: number
    rewardDays?: number
  },
): Promise<
  SiteEventScheduleEntry | null | 'invalid-range' | 'invalid-phases' | 'type-not-found'
> {
  const [existing] = await db
    .select()
    .from(siteEventSchedule)
    .where(eq(siteEventSchedule.id, id))
    .limit(1)
  if (!existing) return null

  const eventTypeId = input.eventTypeId ?? existing.eventTypeId
  const startDate = input.startDate ?? existing.startDate
  const endDate = input.endDate ?? existing.endDate
  const registrationDays = input.registrationDays ?? existing.registrationDays
  const rewardDays = input.rewardDays ?? existing.rewardDays

  if (startDate > endDate) return 'invalid-range'
  if (!areSchedulePhasesValid({ startDate, endDate, registrationDays, rewardDays })) {
    return 'invalid-phases'
  }

  if (input.eventTypeId) {
    const [type] = await db
      .select({ id: siteEventTypes.id })
      .from(siteEventTypes)
      .where(eq(siteEventTypes.id, input.eventTypeId))
      .limit(1)
    if (!type) return 'type-not-found'
  }

  const [row] = await db
    .update(siteEventSchedule)
    .set({
      eventTypeId,
      startDate,
      endDate,
      registrationDays,
      rewardDays,
    })
    .where(eq(siteEventSchedule.id, id))
    .returning()

  if (!row) return null

  const [joined] = await selectScheduleJoined(db, eq(siteEventSchedule.id, id))
  return joined ? mapScheduleEntry(joined) : null
}

export async function deleteSiteEventScheduleEntry(db: Db, id: string): Promise<boolean> {
  const deleted = await db
    .delete(siteEventSchedule)
    .where(eq(siteEventSchedule.id, id))
    .returning({ id: siteEventSchedule.id })
  return deleted.length > 0
}
