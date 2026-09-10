ALTER TABLE "user_states" ADD COLUMN IF NOT EXISTS "accept_trade_offers" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "card_trade_user_states" ADD COLUMN IF NOT EXISTS "accept_trade_offers" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_trade_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "card_trade_events"("id") ON DELETE cascade,
  "from_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "to_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "offered_card_key" text,
  "requested_card_key" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_trade_proposals_to_event_status_idx" ON "card_trade_proposals" ("to_user_id","event_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_trade_proposals_from_event_status_idx" ON "card_trade_proposals" ("from_user_id","event_id","status");
--> statement-breakpoint
-- Replace share slugs that equal game UID with opaque hashes (privacy).
UPDATE "card_trade_user_states" AS cts
SET "share_slug" = substr(md5(random()::text || cts."user_id"::text || cts."event_id"::text || clock_timestamp()::text), 1, 16)
FROM "users" AS u
WHERE cts."user_id" = u."id"
  AND cts."share_slug" IS NOT NULL
  AND u."uid" IS NOT NULL
  AND cts."share_slug" = u."uid";
--> statement-breakpoint
UPDATE "user_states" AS us
SET "share_slug" = substr(md5(random()::text || us."user_id"::text || clock_timestamp()::text), 1, 16)
FROM "users" AS u
WHERE us."user_id" = u."id"
  AND us."share_slug" IS NOT NULL
  AND u."uid" IS NOT NULL
  AND us."share_slug" = u."uid";
