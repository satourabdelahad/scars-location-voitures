ALTER TABLE "deals" ADD COLUMN "contact_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "next_action" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "sent_to_client_at" timestamp with time zone;--> statement-breakpoint
UPDATE "deals" SET "contact_at" = "created_at";
