-- Game profiles: site account ↔ many game identities (owner + admins).
CREATE TABLE IF NOT EXISTS "profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_uid" text NOT NULL UNIQUE,
  "nickname" text NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_members" (
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role" text NOT NULL,
  PRIMARY KEY ("profile_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_members_user_id_idx" ON "profile_members" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_claims" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE cascade,
  "claimant_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "screenshot_path" text NOT NULL,
  "message" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "resolved_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profile_claims_pending_unique"
  ON "profile_claims" ("profile_id", "claimant_user_id")
  WHERE "status" = 'pending';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active_profile_id" uuid;
--> statement-breakpoint

-- Backfill one profile per user that already has a game UID.
INSERT INTO "profiles" ("id", "game_uid", "nickname", "owner_user_id", "created_at")
SELECT gen_random_uuid(), u."uid", u."username", u."id", COALESCE(u."created_at", now())
FROM "users" u
WHERE u."uid" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "profiles" p WHERE p."game_uid" = u."uid");
--> statement-breakpoint
INSERT INTO "profile_members" ("profile_id", "user_id", "role")
SELECT p."id", p."owner_user_id", 'owner'
FROM "profiles" p
WHERE NOT EXISTS (
  SELECT 1 FROM "profile_members" m
  WHERE m."profile_id" = p."id" AND m."user_id" = p."owner_user_id"
);
--> statement-breakpoint
UPDATE "users" u
SET "active_profile_id" = p."id"
FROM "profiles" p
WHERE p."owner_user_id" = u."id"
  AND u."active_profile_id" IS NULL
  AND u."uid" IS NOT NULL
  AND p."game_uid" = u."uid";
--> statement-breakpoint

-- Card-trade state: user_id → profile_id
CREATE TABLE IF NOT EXISTS "card_trade_profile_states" (
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE cascade,
  "event_id" uuid NOT NULL REFERENCES "card_trade_events"("id") ON DELETE cascade,
  "data" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "share_enabled" boolean DEFAULT false NOT NULL,
  "share_slug" text,
  "accept_trade_offers" boolean DEFAULT true NOT NULL,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  PRIMARY KEY ("profile_id", "event_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "card_trade_profile_states_event_share_slug_idx"
  ON "card_trade_profile_states" ("event_id", "share_slug");
--> statement-breakpoint
INSERT INTO "card_trade_profile_states" (
  "profile_id", "event_id", "data", "updated_at",
  "share_enabled", "share_slug", "accept_trade_offers"
)
SELECT p."id", cts."event_id", cts."data", cts."updated_at",
       cts."share_enabled", cts."share_slug", cts."accept_trade_offers"
FROM "card_trade_user_states" cts
JOIN "profiles" p ON p."owner_user_id" = cts."user_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- Legacy summer-party state → profile
CREATE TABLE IF NOT EXISTS "profile_states" (
  "profile_id" uuid PRIMARY KEY REFERENCES "profiles"("id") ON DELETE cascade,
  "data" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "share_enabled" boolean DEFAULT false NOT NULL,
  "share_slug" text UNIQUE,
  "accept_trade_offers" boolean DEFAULT true NOT NULL,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
INSERT INTO "profile_states" (
  "profile_id", "data", "updated_at",
  "share_enabled", "share_slug", "accept_trade_offers"
)
SELECT p."id", us."data", us."updated_at",
       us."share_enabled", us."share_slug", us."accept_trade_offers"
FROM "user_states" us
JOIN "profiles" p ON p."owner_user_id" = us."user_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- Proposals: add profile FKs (keep user ids for audit)
ALTER TABLE "card_trade_proposals" ADD COLUMN IF NOT EXISTS "from_profile_id" uuid REFERENCES "profiles"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "card_trade_proposals" ADD COLUMN IF NOT EXISTS "to_profile_id" uuid REFERENCES "profiles"("id") ON DELETE cascade;
--> statement-breakpoint
UPDATE "card_trade_proposals" prop
SET "from_profile_id" = p."id"
FROM "profiles" p
WHERE p."owner_user_id" = prop."from_user_id"
  AND prop."from_profile_id" IS NULL;
--> statement-breakpoint
UPDATE "card_trade_proposals" prop
SET "to_profile_id" = p."id"
FROM "profiles" p
WHERE p."owner_user_id" = prop."to_user_id"
  AND prop."to_profile_id" IS NULL;
--> statement-breakpoint
-- Drop proposals that cannot be mapped (users without profiles).
DELETE FROM "card_trade_proposals"
WHERE "from_profile_id" IS NULL OR "to_profile_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "card_trade_proposals" ALTER COLUMN "from_profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "card_trade_proposals" ALTER COLUMN "to_profile_id" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_trade_proposals_to_profile_event_status_idx"
  ON "card_trade_proposals" ("to_profile_id", "event_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_trade_proposals_from_profile_event_status_idx"
  ON "card_trade_proposals" ("from_profile_id", "event_id", "status");
--> statement-breakpoint

-- Cozy Farm listings → profile
ALTER TABLE "cozy_farm_listings" ADD COLUMN IF NOT EXISTS "profile_id" uuid REFERENCES "profiles"("id") ON DELETE cascade;
--> statement-breakpoint
UPDATE "cozy_farm_listings" l
SET "profile_id" = p."id"
FROM "profiles" p
WHERE p."owner_user_id" = l."user_id"
  AND l."profile_id" IS NULL;
--> statement-breakpoint
DELETE FROM "cozy_farm_listings" WHERE "profile_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "cozy_farm_listings" ALTER COLUMN "profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "cozy_farm_listings" DROP COLUMN IF EXISTS "user_id";
--> statement-breakpoint

-- Drop old state tables and users.uid
DROP TABLE IF EXISTS "card_trade_user_states";
--> statement-breakpoint
DROP TABLE IF EXISTS "user_states";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "uid";
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_active_profile_id_fk'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_active_profile_id_fk"
      FOREIGN KEY ("active_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
  END IF;
END $$;
