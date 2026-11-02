CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(20) NOT NULL,
	"host_id" integer NOT NULL,
	"guest_id" integer,
	"is_public" boolean NOT NULL,
	"code" varchar(6),
	"piece_count" integer DEFAULT 5 NOT NULL,
	"board" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'waiting' NOT NULL,
	CONSTRAINT "rooms_host_id_unique" UNIQUE("host_id"),
	CONSTRAINT "rooms_guest_id_unique" UNIQUE("guest_id"),
	CONSTRAINT "rooms_code_unique" UNIQUE("code"),
	CONSTRAINT "rooms_public_code" CHECK (("rooms"."is_public" AND "rooms"."code" IS NULL) OR (NOT "rooms"."is_public" AND "rooms"."code" IS NOT NULL)),
	CONSTRAINT "rooms_piece_count" CHECK ("rooms"."piece_count" IN (5, 7, 9)),
	CONSTRAINT "rooms_status" CHECK ("rooms"."status" IN ('waiting', 'playing')),
	CONSTRAINT "rooms_not_own_guest" CHECK ("rooms"."guest_id" IS NULL OR "rooms"."guest_id" <> "rooms"."host_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"nickname" varchar(12) NOT NULL,
	"password" text NOT NULL,
	"character_id" varchar(16) NOT NULL,
	"total_games" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "users_total_games_nonneg" CHECK ("users"."total_games" >= 0),
	CONSTRAINT "users_wins_nonneg" CHECK ("users"."wins" >= 0),
	CONSTRAINT "users_losses_nonneg" CHECK ("users"."losses" >= 0),
	CONSTRAINT "users_record_within_total" CHECK ("users"."wins" + "users"."losses" <= "users"."total_games")
);
--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_guest_id_users_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "users_nickname_lower_idx" ON "users" USING btree (lower("nickname"));