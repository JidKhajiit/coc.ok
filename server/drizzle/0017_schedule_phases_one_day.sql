UPDATE "site_event_schedule"
SET "registration_days" = 1
WHERE "registration_days" > 1;
--> statement-breakpoint
UPDATE "site_event_schedule"
SET "reward_days" = 1
WHERE "reward_days" > 1;
