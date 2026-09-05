-- Allow stacked reactions (superadmin) via weight per vote row

ALTER TABLE "cozy_farm_votes" ADD COLUMN IF NOT EXISTS "weight" integer DEFAULT 1 NOT NULL;
