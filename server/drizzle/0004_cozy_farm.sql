-- Cozy Farm: player UID listings and votes

CREATE TABLE IF NOT EXISTS "cozy_farm_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL UNIQUE,
	"game_uid" text NOT NULL,
	"bonus_dragonfruit" real,
	"bonus_carrot" real,
	"bonus_bamboo" real,
	"bonus_phantom" real,
	"bonus_cranberry" real,
	"bonus_orange" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cozy_farm_listings" ADD CONSTRAINT "cozy_farm_listings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cozy_farm_votes" (
	"listing_id" uuid NOT NULL,
	"voter_user_id" uuid NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "cozy_farm_votes_pkey" PRIMARY KEY("listing_id","voter_user_id")
);
--> statement-breakpoint
ALTER TABLE "cozy_farm_votes" ADD CONSTRAINT "cozy_farm_votes_listing_id_cozy_farm_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."cozy_farm_listings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cozy_farm_votes" ADD CONSTRAINT "cozy_farm_votes_voter_user_id_users_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cozy_farm_votes" ADD CONSTRAINT "cozy_farm_votes_value_check" CHECK ("value" IN (1, -1));
