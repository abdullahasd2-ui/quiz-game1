CREATE TABLE "kick_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"kick_user_id" integer NOT NULL,
	"channel" varchar(64) NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kick_streams" (
	"id" serial PRIMARY KEY NOT NULL,
	"session" varchar(32) NOT NULL,
	"channel" varchar(64) NOT NULL,
	"variant" varchar(10),
	"test" boolean DEFAULT false NOT NULL,
	"players" integer DEFAULT 0 NOT NULL,
	"rounds" smallint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"game_started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kick_streams_session_unique" UNIQUE("session")
);
--> statement-breakpoint
CREATE INDEX "kick_links_linked_at_idx" ON "kick_links" USING btree ("linked_at");--> statement-breakpoint
CREATE INDEX "kick_streams_started_at_idx" ON "kick_streams" USING btree ("started_at");