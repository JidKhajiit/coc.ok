ALTER TABLE "user_states" ADD COLUMN IF NOT EXISTS "share_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_states" ADD COLUMN IF NOT EXISTS "share_slug" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_states_share_slug_unique" ON "user_states" ("share_slug");
