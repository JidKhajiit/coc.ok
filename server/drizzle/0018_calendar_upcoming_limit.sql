CREATE TABLE IF NOT EXISTS "site_calendar_settings" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "upcoming_limit" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
INSERT INTO "site_calendar_settings" ("id", "upcoming_limit")
VALUES (1, 5)
ON CONFLICT ("id") DO NOTHING;
