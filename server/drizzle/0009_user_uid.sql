ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "uid" text;
CREATE UNIQUE INDEX IF NOT EXISTS "users_uid_unique" ON "users" ("uid");
