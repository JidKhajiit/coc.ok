import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import { profileMembers, profiles, users } from '../db/schema.js'

export type ProfileRole = 'owner' | 'admin'

export type ProfileRow = {
  id: string
  gameUid: string
  nickname: string
  ownerUserId: string
  createdAt: Date
}

export type ProfileAccess = ProfileRow & { role: ProfileRole }

export async function getMembership(
  db: Db,
  profileId: string,
  userId: string,
): Promise<ProfileAccess | null> {
  const rows = await db
    .select({
      id: profiles.id,
      gameUid: profiles.gameUid,
      nickname: profiles.nickname,
      ownerUserId: profiles.ownerUserId,
      createdAt: profiles.createdAt,
      role: profileMembers.role,
    })
    .from(profileMembers)
    .innerJoin(profiles, eq(profiles.id, profileMembers.profileId))
    .where(and(eq(profileMembers.profileId, profileId), eq(profileMembers.userId, userId)))
    .limit(1)

  const row = rows[0]
  if (!row || (row.role !== 'owner' && row.role !== 'admin')) return null
  return { ...row, role: row.role }
}

export async function requireProfileAccess(
  db: Db,
  profileId: string,
  userId: string,
  minRole: ProfileRole = 'admin',
): Promise<ProfileAccess | null> {
  const access = await getMembership(db, profileId, userId)
  if (!access) return null
  if (minRole === 'owner' && access.role !== 'owner') return null
  return access
}

export async function listUserProfiles(db: Db, userId: string) {
  return db
    .select({
      id: profiles.id,
      gameUid: profiles.gameUid,
      nickname: profiles.nickname,
      ownerUserId: profiles.ownerUserId,
      createdAt: profiles.createdAt,
      role: profileMembers.role,
    })
    .from(profileMembers)
    .innerJoin(profiles, eq(profiles.id, profileMembers.profileId))
    .where(eq(profileMembers.userId, userId))
}

export async function resolveActiveProfile(
  db: Db,
  userId: string,
  activeProfileId: string | null | undefined,
): Promise<ProfileAccess | null> {
  if (activeProfileId) {
    const access = await getMembership(db, activeProfileId, userId)
    if (access) return access
  }

  const owned = await db
    .select({
      id: profiles.id,
      gameUid: profiles.gameUid,
      nickname: profiles.nickname,
      ownerUserId: profiles.ownerUserId,
      createdAt: profiles.createdAt,
      role: profileMembers.role,
    })
    .from(profileMembers)
    .innerJoin(profiles, eq(profiles.id, profileMembers.profileId))
    .where(and(eq(profileMembers.userId, userId), eq(profileMembers.role, 'owner')))
    .limit(1)

  if (owned[0] && (owned[0].role === 'owner' || owned[0].role === 'admin')) {
    const profile = { ...owned[0], role: owned[0].role as ProfileRole }
    await db.update(users).set({ activeProfileId: profile.id }).where(eq(users.id, userId))
    return profile
  }

  const any = await listUserProfiles(db, userId)
  const first = any[0]
  if (!first || (first.role !== 'owner' && first.role !== 'admin')) return null
  const profile = { ...first, role: first.role as ProfileRole }
  await db.update(users).set({ activeProfileId: profile.id }).where(eq(users.id, userId))
  return profile
}

export function publicProfile(p: {
  id: string
  gameUid: string
  nickname: string
  ownerUserId: string
  role?: string
  createdAt?: Date
}) {
  return {
    id: p.id,
    gameUid: p.gameUid,
    nickname: p.nickname,
    ownerUserId: p.ownerUserId,
    role: p.role ?? undefined,
    createdAt: p.createdAt?.toISOString(),
  }
}
