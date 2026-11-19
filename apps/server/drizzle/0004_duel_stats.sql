CREATE TABLE "kick_duels" (
	"id" serial PRIMARY KEY NOT NULL,
	"session" varchar(32) NOT NULL,
	"mode" varchar(10) NOT NULL,
	"single" boolean DEFAULT false NOT NULL,
	"test" boolean DEFAULT false NOT NULL,
	"channel_a" varchar(64) NOT NULL,
	"channel_b" varchar(64) NOT NULL,
	"players_a" integer DEFAULT 0 NOT NULL,
	"players_b" integer DEFAULT 0 NOT NULL,
	"rounds" smallint DEFAULT 0 NOT NULL,
	"winner" varchar(4),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"game_started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kick_duels_session_unique" UNIQUE("session")
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "solo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "kick_duels_started_at_idx" ON "kick_duels" USING btree ("started_at");