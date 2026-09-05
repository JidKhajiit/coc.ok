import { boolean, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { AppState } from '../../../shared/types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Users & Auth
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  email: text('email').unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export const authTokens = pgTable('auth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userStates = pgTable('user_states', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<AppState>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  shareEnabled: boolean('share_enabled').notNull().default(false),
  shareSlug: text('share_slug').unique(),
})

// ─────────────────────────────────────────────────────────────────────────────
// RBAC: Roles & Permissions
// ─────────────────────────────────────────────────────────────────────────────

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
})

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
})

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
)

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
)

// ─────────────────────────────────────────────────────────────────────────────
// Cozy Farm
// ─────────────────────────────────────────────────────────────────────────────

export const cozyFarmListings = pgTable('cozy_farm_listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  gameUid: text('game_uid').notNull(),
  bonusDragonfruit: real('bonus_dragonfruit'),
  bonusCarrot: real('bonus_carrot'),
  bonusBamboo: real('bonus_bamboo'),
  bonusPhantom: real('bonus_phantom'),
  bonusCranberry: real('bonus_cranberry'),
  bonusOrange: real('bonus_orange'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cozyFarmVotes = pgTable(
  'cozy_farm_votes',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => cozyFarmListings.id, { onDelete: 'cascade' }),
    voterUserId: uuid('voter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: integer('value').notNull(), // 1 = like, -1 = dislike
    /** Regular users: always 1. Superadmin may stack multiple reactions. */
    weight: integer('weight').notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.voterUserId] })],
)
