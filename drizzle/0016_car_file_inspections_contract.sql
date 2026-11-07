CREATE TYPE "public"."car_record_kind" AS ENUM('insurance', 'vignette', 'oil_change', 'technical_inspection', 'expense');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('maintenance', 'repair', 'tyres', 'cleaning', 'fuel', 'parts', 'fine', 'other');--> statement-breakpoint
CREATE TYPE "public"."inspection_kind" AS ENUM('departure', 'return');--> statement-breakpoint
CREATE TABLE "car_inspection_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"inspection_id" uuid NOT NULL,
	"public_id" text NOT NULL,
	"resource_type" varchar(16) DEFAULT 'image' NOT NULL,
	"format" varchar(16),
	"caption" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"car_id" uuid NOT NULL,
	"reservation_id" uuid,
	"kind" "inspection_kind" NOT NULL,
	"mileage" integer NOT NULL,
	"fuel_eighths" smallint NOT NULL,
	"damages" text,
	"notes" text,
	"signed_by_name" varchar(160),
	"signature_public_id" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "car_inspections_fuel_chk" CHECK ("car_inspections"."fuel_eighths" BETWEEN 0 AND 8),
	CONSTRAINT "car_inspections_mileage_chk" CHECK ("car_inspections"."mileage" >= 0)
);
--> statement-breakpoint
CREATE TABLE "car_record_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"public_id" text NOT NULL,
	"resource_type" varchar(16) DEFAULT 'image' NOT NULL,
	"format" varchar(16),
	"bytes" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"car_id" uuid NOT NULL,
	"kind" "car_record_kind" NOT NULL,
	"category" "expense_category",
	"performed_on" date NOT NULL,
	"valid_until" date,
	"mileage" integer,
	"next_mileage" integer,
	"amount" numeric(10, 2),
	"provider" varchar(160),
	"reference" varchar(120),
	"notes" text,
	"voided_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "car_records_amount_chk" CHECK ("car_records"."amount" IS NULL OR "car_records"."amount" >= 0),
	CONSTRAINT "car_records_dates_chk" CHECK ("car_records"."valid_until" IS NULL OR "car_records"."valid_until" >= "car_records"."performed_on")
);
--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "license_expires_on" date;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "blacklisted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "blacklisted_by" uuid;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "blacklist_reason" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "license_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "license_checked_by" uuid;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "driver_license_expires_on" date;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "original_end_date" date;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "extended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notifications_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "car_inspection_photos" ADD CONSTRAINT "car_inspection_photos_inspection_id_car_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."car_inspections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_inspections" ADD CONSTRAINT "car_inspections_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_inspections" ADD CONSTRAINT "car_inspections_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_inspections" ADD CONSTRAINT "car_inspections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_record_files" ADD CONSTRAINT "car_record_files_record_id_car_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."car_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_record_files" ADD CONSTRAINT "car_record_files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_records" ADD CONSTRAINT "car_records_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_records" ADD CONSTRAINT "car_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_records" ADD CONSTRAINT "car_records_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "car_inspection_photos_idx" ON "car_inspection_photos" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "car_inspections_car_idx" ON "car_inspections" USING btree ("car_id","created_at");--> statement-breakpoint
CREATE INDEX "car_inspections_reservation_idx" ON "car_inspections" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "car_record_files_record_idx" ON "car_record_files" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "car_records_car_idx" ON "car_records" USING btree ("car_id","kind","performed_on");--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_blacklisted_by_users_id_fk" FOREIGN KEY ("blacklisted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_license_checked_by_users_id_fk" FOREIGN KEY ("license_checked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Le dossier voiture et les états des lieux ne se suppriment jamais (on annule une saisie erronée).
CREATE TRIGGER scar_forbid_delete BEFORE DELETE ON "car_records" FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();
--> statement-breakpoint
CREATE TRIGGER scar_forbid_delete BEFORE DELETE ON "car_inspections" FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();
