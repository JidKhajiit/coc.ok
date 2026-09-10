CREATE TABLE IF NOT EXISTS "device_accounts" (
  "device_id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "session_id" text NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "device_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade,
  CONSTRAINT "device_accounts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE cascade,
  CONSTRAINT "device_accounts_pkey" PRIMARY KEY ("device_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_accounts_device_id_idx" ON "device_accounts" ("device_id");
