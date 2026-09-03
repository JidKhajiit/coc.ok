-- RBAC: Roles & Permissions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL UNIQUE,
	"description" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL UNIQUE,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	PRIMARY KEY ("role_id", "permission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	PRIMARY KEY ("user_id", "role_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Base Permissions
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "permissions" ("name", "description") VALUES
  ('admin:access', 'Доступ к админ-панели'),
  ('users:view', 'Просмотр списка пользователей'),
  ('users:edit', 'Редактирование пользователей (смена роли)'),
  ('users:delete', 'Удаление пользователей'),
  ('roles:view', 'Просмотр ролей'),
  ('roles:manage', 'Создание и редактирование ролей и разрешений')
ON CONFLICT ("name") DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Base Roles
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "roles" ("name", "description", "is_system") VALUES
  ('user', 'Обычный пользователь', true),
  ('admin', 'Администратор', true),
  ('superadmin', 'Суперадминистратор', true)
ON CONFLICT ("name") DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Role-Permission mappings
-- ─────────────────────────────────────────────────────────────────────────────

-- admin: admin:access, users:view, users:edit, roles:view
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r, "permissions" p
WHERE r.name = 'admin' AND p.name IN ('admin:access', 'users:view', 'users:edit', 'roles:view')
ON CONFLICT DO NOTHING;

-- superadmin: all permissions
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r, "permissions" p
WHERE r.name = 'superadmin'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Assign 'user' role to all existing users who have no roles
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "user_roles" ("user_id", "role_id")
SELECT u.id, r.id FROM "users" u, "roles" r
WHERE r.name = 'user'
  AND NOT EXISTS (SELECT 1 FROM "user_roles" ur WHERE ur.user_id = u.id)
ON CONFLICT DO NOTHING;
