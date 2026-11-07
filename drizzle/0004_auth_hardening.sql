CREATE TABLE "login_failures" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(300) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_pending_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_last_step" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_recovery_codes" jsonb;--> statement-breakpoint
CREATE INDEX "login_failures_key_idx" ON "login_failures" USING btree ("key","created_at");