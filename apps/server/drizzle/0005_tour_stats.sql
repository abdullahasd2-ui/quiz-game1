CREATE TABLE "tour_runs" (
	"day" date NOT NULL,
	"step" varchar(16) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tour_runs_day_step_pk" PRIMARY KEY("day","step")
);
