CREATE TYPE "public"."question_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "reference" varchar(500);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "status" "question_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "source" varchar(40);--> statement-breakpoint
CREATE INDEX "questions_status_idx" ON "questions" USING btree ("status");