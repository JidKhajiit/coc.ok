import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
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
// Card Trades Events
// ─────────────────────────────────────────────────────────────────────────────

export const cardTradeEvents = pgTable('card_trade_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cardTradeSets = pgTable(
  'card_trade_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => cardTradeEvents.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    fromNumber: integer('from_number').notNull(),
    toNumber: integer('to_number').notNull(),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [uniqueIndex('card_trade_sets_event_slug_idx').on(t.eventId, t.slug)],
)

export const cardTradeCards = pgTable(
  'card_trade_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => cardTradeEvents.id, { onDelete: 'cascade' }),
    cardKey: text('card_key').notNull(),
    number: integer('number').notNull(),
    name: text('name').notNull(),
    rarity: integer('rarity').notNull(),
    color: text('color').notNull(),
    setSlug: text('set_slug').notNull(),
    unknownName: boolean('unknown_name').notNull().default(false),
  },
  (t) => [
    uniqueIndex('card_trade_cards_event_key_idx').on(t.eventId, t.cardKey),
    uniqueIndex('card_trade_cards_event_number_idx').on(t.eventId, t.number),
  ],
)

export const cardTradeUserStates = pgTable(
  'card_trade_user_states',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => cardTradeEvents.id, { onDelete: 'cascade' }),
    data: jsonb('data').$type<AppState>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    shareEnabled: boolean('share_enabled').notNull().default(false),
    shareSlug: text('share_slug'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.eventId] }),
    uniqueIndex('card_trade_user_states_event_share_slug_idx').on(t.eventId, t.shareSlug),
  ],
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
