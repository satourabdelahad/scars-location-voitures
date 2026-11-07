CREATE TYPE "public"."client_document_kind" AS ENUM('license_front', 'license_back', 'id_front', 'id_back');--> statement-breakpoint
CREATE TYPE "public"."extension_status" AS ENUM('pending', 'accepted', 'refused');--> statement-breakpoint
CREATE TYPE "public"."extra_pricing" AS ENUM('per_day', 'once');--> statement-breakpoint
CREATE TABLE "client_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"reservation_id" uuid,
	"kind" "client_document_kind" NOT NULL,
	"public_id" text NOT NULL,
	"resource_type" varchar(16) DEFAULT 'image' NOT NULL,
	"format" varchar(16),
	"bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation_extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"from_end_date" date NOT NULL,
	"requested_end_date" date NOT NULL,
	"status" "extension_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"reason" text,
	"requested_by" uuid,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "id_card_number" varchar(64);--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "newsletter_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "extras" ADD COLUMN "name" varchar(160);--> statement-breakpoint
ALTER TABLE "extras" ADD COLUMN "pricing" "extra_pricing" DEFAULT 'per_day' NOT NULL;--> statement-breakpoint
ALTER TABLE "extras" ADD COLUMN "sort_order" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_extras" ADD COLUMN "pricing" "extra_pricing" DEFAULT 'per_day' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "pickup_time" time;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "return_time" time;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "with_driver" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "driver_total" numeric(10, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_extensions" ADD CONSTRAINT "reservation_extensions_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_extensions" ADD CONSTRAINT "reservation_extensions_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_extensions" ADD CONSTRAINT "reservation_extensions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_documents_client_idx" ON "client_documents" USING btree ("client_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "reservation_extensions_res_idx" ON "reservation_extensions" USING btree ("reservation_id","created_at");--> statement-breakpoint
-- Noms des suppléments existants (modifiables ensuite par l'administrateur).
UPDATE "extras" SET "name" = CASE "code"
  WHEN 'child_seat' THEN 'Siège enfant'
  WHEN 'gps' THEN 'Navigateur GPS'
  WHEN 'extra_driver' THEN 'Conducteur supplémentaire'
  WHEN 'full_insurance' THEN 'Assurance tous risques sans franchise'
  WHEN 'wifi' THEN 'Wi-Fi mobile'
  ELSE "code" END WHERE "name" IS NULL;
--> statement-breakpoint
UPDATE "extras" SET "pricing" = 'once' WHERE "code" = 'child_seat';
--> statement-breakpoint
INSERT INTO "extras" ("code", "name", "price_per_day", "pricing", "sort_order", "is_active") VALUES
  ('baby_seat', 'Siège bébé (9-36 kg)', 0, 'once', 3, true),
  ('assistance', 'Assistance (Maroc Assistance)', 0, 'once', 4, true)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
CREATE TRIGGER scar_forbid_delete BEFORE DELETE ON "reservation_extensions" FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();
