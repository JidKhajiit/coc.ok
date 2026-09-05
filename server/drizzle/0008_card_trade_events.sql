CREATE TABLE IF NOT EXISTS "card_trade_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_trade_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "from_number" integer NOT NULL,
  "to_number" integer NOT NULL,
  "sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_trade_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "card_key" text NOT NULL,
  "number" integer NOT NULL,
  "name" text NOT NULL,
  "rarity" integer NOT NULL,
  "color" text NOT NULL,
  "set_slug" text NOT NULL,
  "unknown_name" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_trade_user_states" (
  "user_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "data" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "share_enabled" boolean DEFAULT false NOT NULL,
  "share_slug" text,
  PRIMARY KEY ("user_id", "event_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "card_trade_sets" ADD CONSTRAINT "card_trade_sets_event_id_card_trade_events_id_fk"
    FOREIGN KEY ("event_id") REFERENCES "public"."card_trade_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "card_trade_cards" ADD CONSTRAINT "card_trade_cards_event_id_card_trade_events_id_fk"
    FOREIGN KEY ("event_id") REFERENCES "public"."card_trade_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "card_trade_user_states" ADD CONSTRAINT "card_trade_user_states_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "card_trade_user_states" ADD CONSTRAINT "card_trade_user_states_event_id_card_trade_events_id_fk"
    FOREIGN KEY ("event_id") REFERENCES "public"."card_trade_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "card_trade_sets_event_slug_idx" ON "card_trade_sets" ("event_id", "slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "card_trade_cards_event_key_idx" ON "card_trade_cards" ("event_id", "card_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "card_trade_cards_event_number_idx" ON "card_trade_cards" ("event_id", "number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "card_trade_user_states_event_share_slug_idx"
  ON "card_trade_user_states" ("event_id", "share_slug")
  WHERE "share_slug" IS NOT NULL;
--> statement-breakpoint
INSERT INTO "permissions" ("name", "description")
VALUES ('events:manage', 'Создание и редактирование карточных эвентов')
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.name IN ('admin', 'superadmin') AND p.name = 'events:manage'
ON CONFLICT DO NOTHING;
