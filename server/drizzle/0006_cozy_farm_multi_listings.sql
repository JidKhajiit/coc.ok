-- Allow multiple listings per user (drop one-listing-per-user unique)

ALTER TABLE "cozy_farm_listings" DROP CONSTRAINT IF EXISTS "cozy_farm_listings_user_id_unique";
--> statement-breakpoint
ALTER TABLE "cozy_farm_listings" DROP CONSTRAINT IF EXISTS "cozy_farm_listings_user_id_key";
