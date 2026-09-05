-- Drop remaining unique(user_id) created by Postgres as *_user_id_key

ALTER TABLE "cozy_farm_listings" DROP CONSTRAINT IF EXISTS "cozy_farm_listings_user_id_key";
