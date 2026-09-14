ALTER TABLE "site_event_schedule"
  ADD COLUMN IF NOT EXISTS "registration_days" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_event_schedule"
  ADD COLUMN IF NOT EXISTS "reward_days" integer DEFAULT 0 NOT NULL;
