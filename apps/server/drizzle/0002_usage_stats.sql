CREATE TYPE "public"."device_platform" AS ENUM('web', 'ios', 'android');--> statement-breakpoint
CREATE TABLE "daily_visits" (
	"day" date NOT NULL,
	"device_id" varchar(64) NOT NULL,
	"platform" "device_platform" NOT NULL,
	"visits" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_visits_day_device_id_pk" PRIMARY KEY("day","device_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(12) NOT NULL,
	"mode" varchar(10) NOT NULL,
	"variant" varchar(10) NOT NULL,
	"category_ids" jsonb,
	"rounds_played" smallint DEFAULT 0 NOT NULL,
	"scores" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"abandoned_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "daily_visits_device_idx" ON "daily_visits" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "games_created_at_idx" ON "games" USING btree ("created_at");