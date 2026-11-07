CREATE TYPE "public"."appointment_kind" AS ENUM('meeting', 'call', 'delivery', 'test_drive', 'other');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('planned', 'done', 'cancelled', 'no_show');--> statement-breakpoint
ALTER TYPE "public"."car_status" ADD VALUE 'maintenance' BEFORE 'deactivated';--> statement-breakpoint
ALTER TYPE "public"."deal_type" ADD VALUE 'question' BEFORE 'negotiation';--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"assigned_to" uuid NOT NULL,
	"kind" "appointment_kind" DEFAULT 'meeting' NOT NULL,
	"status" "appointment_status" DEFAULT 'planned' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_min" smallint DEFAULT 30 NOT NULL,
	"agency_id" integer,
	"car_id" uuid,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_duration_chk" CHECK ("appointments"."duration_min" BETWEEN 5 AND 600)
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"civility" "civility",
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"whatsapp" varchar(32),
	"city" varchar(120),
	"birth_date" date,
	"license_number" varchar(64),
	"notes" text,
	"deactivation_reason" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cars" DROP CONSTRAINT "cars_deactivation_chk";--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "manager_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "client_id" uuid;--> statement-breakpoint
-- Modèles par langue : les modèles déjà enregistrés deviennent les modèles français.
ALTER TABLE "email_templates" ADD COLUMN "locale" "locale" DEFAULT 'fr' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_templates" DROP CONSTRAINT "email_templates_pkey";--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_key_locale_pk" PRIMARY KEY("key","locale");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_assigned_idx" ON "appointments" USING btree ("assigned_to","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_client_idx" ON "appointments" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deals_client_idx" ON "deals" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_deactivation_chk" CHECK ("cars"."status" <> 'deactivated' OR ("cars"."deactivation_reason" IS NOT NULL AND "cars"."deactivated_at" IS NOT NULL));--> statement-breakpoint
-- Comptes, fiches clients et rendez-vous ne sont jamais supprimés (désactivation / annulation).
CREATE TRIGGER users_no_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();--> statement-breakpoint
CREATE TRIGGER client_profiles_no_delete BEFORE DELETE ON client_profiles FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();--> statement-breakpoint
CREATE TRIGGER appointments_no_delete BEFORE DELETE ON appointments FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();