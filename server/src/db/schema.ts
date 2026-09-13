import {
  boolean,
  index,
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
  /** Currently selected game profile for this site account. */
  activeProfileId: uuid('active_profile_id'),
  /** Public path to avatar image, e.g. `/uploads/avatars/{id}.jpg`. */
  avatarUrl: text('avatar_url'),
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

/** Browser device ↔ multiple logged-in accounts (sessions stay httpOnly). */
export const deviceAccounts = pgTable(
  'device_accounts',
  {
    deviceId: text('device_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.userId] })],
)

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

// ─────────────────────────────────────────────────────────────────────────────
// Game profiles (UID + nickname; owner + admins)
// ─────────────────────────────────────────────────────────────────────────────

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameUid: text('game_uid').notNull().unique(),
  nickname: text('nickname').notNull(),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /** Soft-delete: profile stays for trade trends; members detached. */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const profileMembers = pgTable(
  'profile_members',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'owner' | 'admin'
  },
  (t) => [
    primaryKey({ columns: [t.profileId, t.userId] }),
    index('profile_members_user_id_idx').on(t.userId),
  ],
)

export const profileClaims = pgTable('profile_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  claimantUserId: uuid('claimant_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  screenshotPath: text('screenshot_path').notNull(),
  message: text('message'),
  status: text('status').notNull().default('pending'), // pending | approved | rejected
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
})

/** Legacy summer-party state keyed by profile. */
export const profileStates = pgTable('profile_states', {
  profileId: uuid('profile_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<AppState>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  shareEnabled: boolean('share_enabled').notNull().default(false),
  shareSlug: text('share_slug').unique(),
  acceptTradeOffers: boolean('accept_trade_offers').notNull().default(true),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
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

export const cardTradeProfileStates = pgTable(
  'card_trade_profile_states',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => cardTradeEvents.id, { onDelete: 'cascade' }),
    data: jsonb('data').$type<AppState>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    shareEnabled: boolean('share_enabled').notNull().default(false),
    shareSlug: text('share_slug'),
    acceptTradeOffers: boolean('accept_trade_offers').notNull().default(true),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    primaryKey({ columns: [t.profileId, t.eventId] }),
    uniqueIndex('card_trade_profile_states_event_share_slug_idx').on(t.eventId, t.shareSlug),
  ],
)

export const cardTradeProposals = pgTable(
  'card_trade_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => cardTradeEvents.id, { onDelete: 'cascade' }),
    fromProfileId: uuid('from_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    toProfileId: uuid('to_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    /** Site user who created the proposal (audit). */
    fromUserId: uuid('from_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Site user who owns/admins the target profile at create time (audit). */
    toUserId: uuid('to_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'trade' | 'gift'
    offeredCardKey: text('offered_card_key'),
    requestedCardKey: text('requested_card_key').notNull(),
    status: text('status').notNull().default('pending'), // pending | accepted | rejected | cancelled
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('card_trade_proposals_to_profile_event_status_idx').on(
      t.toProfileId,
      t.eventId,
      t.status,
    ),
    index('card_trade_proposals_from_profile_event_status_idx').on(
      t.fromProfileId,
      t.eventId,
      t.status,
    ),
  ],
)

// ─────────────────────────────────────────────────────────────────────────────
// Cozy Farm
// ─────────────────────────────────────────────────────────────────────────────

export const cozyFarmListings = pgTable('cozy_farm_listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
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
