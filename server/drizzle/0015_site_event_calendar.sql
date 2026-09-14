CREATE TABLE IF NOT EXISTS "site_event_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "name_ru" text NOT NULL,
  "name_en" text NOT NULL,
  "path" text,
  "color" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_event_schedule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type_id" uuid NOT NULL,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "site_event_schedule" ADD CONSTRAINT "site_event_schedule_event_type_id_site_event_types_id_fk"
    FOREIGN KEY ("event_type_id") REFERENCES "public"."site_event_types"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_event_schedule_dates_idx" ON "site_event_schedule" ("start_date", "end_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_event_schedule_type_idx" ON "site_event_schedule" ("event_type_id");
--> statement-breakpoint
INSERT INTO "permissions" ("name", "description")
VALUES ('calendar:manage', 'Управление каталогом и графиком эвентов')
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.name IN ('admin', 'superadmin') AND p.name = 'calendar:manage'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "site_event_types" ("slug", "name_ru", "name_en", "path", "color")
VALUES
  (
    'gold-rush-sea-ruffians',
    'Турнир Золотой лихорадки: Морские грубины',
    'Gold Rush Tournament: Sea Ruffians',
    NULL,
    '#c9a227'
  ),
  (
    'fishing-race',
    'Рыбацкая гонка',
    'Fishing Race',
    NULL,
    '#3b82a0'
  ),
  (
    'cozy-farm',
    'Уютная ферма',
    'Cozy Farm',
    '/cozy-farm',
    '#2f7a55'
  )
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "site_event_schedule" ("event_type_id", "start_date", "end_date")
SELECT t.id, v.start_date, v.end_date
FROM (
  VALUES
    ('gold-rush-sea-ruffians', '2026-09-03', '2026-09-08'),
    ('fishing-race', '2026-09-06', '2026-09-08'),
    ('cozy-farm', '2026-09-03', '2026-09-05')
) AS v(slug, start_date, end_date)
JOIN "site_event_types" t ON t.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1
  FROM "site_event_schedule" s
  WHERE s.event_type_id = t.id
    AND s.start_date = v.start_date
    AND s.end_date = v.end_date
);
