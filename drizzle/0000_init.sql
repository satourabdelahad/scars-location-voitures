CREATE TYPE "public"."account_status" AS ENUM('active', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."car_category" AS ENUM('economy', 'compact', 'sedan', 'suv', 'luxury', 'van', 'convertible', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."car_deactivation_reason" AS ENUM('stolen', 'sold', 'totaled', 'accident', 'end_of_lease', 'other');--> statement-breakpoint
CREATE TYPE "public"."car_status" AS ENUM('active', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."civility" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('freelance', 'cdi');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('cin_front', 'cin_back', 'license_front', 'license_back');--> statement-breakpoint
CREATE TYPE "public"."fuel" AS ENUM('petrol', 'diesel', 'hybrid', 'electric');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('fr', 'ary', 'ar', 'en', 'es', 'de', 'ja', 'zh', 'ko');--> statement-breakpoint
CREATE TYPE "public"."manager_event" AS ENUM('created', 'updated', 'deactivated', 'reactivated');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('married', 'widowed', 'single');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('pending', 'confirmed', 'ongoing', 'completed', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'manager', 'client');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('invite', 'reset');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('manual', 'automatic');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "agencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"city" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"address" text NOT NULL,
	"phone" varchar(32),
	"is_airport" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agencies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"entity" varchar(32) NOT NULL,
	"entity_id" text NOT NULL,
	"action" varchar(32) NOT NULL,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"car_id" uuid NOT NULL,
	"public_id" text NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_translations" (
	"car_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "car_translations_car_id_locale_pk" PRIMARY KEY("car_id","locale")
);
--> statement-breakpoint
CREATE TABLE "cars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" integer NOT NULL,
	"brand" varchar(80) NOT NULL,
	"model" varchar(80) NOT NULL,
	"year" smallint NOT NULL,
	"category" "car_category" NOT NULL,
	"transmission" "transmission" NOT NULL,
	"fuel" "fuel" NOT NULL,
	"seats" smallint NOT NULL,
	"doors" smallint NOT NULL,
	"luggage" smallint DEFAULT 2 NOT NULL,
	"color_name" varchar(60) NOT NULL,
	"color_hex" varchar(7) DEFAULT '#9AA3B5' NOT NULL,
	"plate_number" varchar(32) NOT NULL,
	"vin" varchar(17),
	"mileage" integer DEFAULT 0 NOT NULL,
	"daily_price" numeric(10, 2) NOT NULL,
	"deposit" numeric(10, 2) DEFAULT 0 NOT NULL,
	"air_conditioning" boolean DEFAULT true NOT NULL,
	"status" "car_status" DEFAULT 'active' NOT NULL,
	"deactivation_reason" "car_deactivation_reason",
	"deactivation_note" text,
	"deactivated_at" timestamp with time zone,
	"deactivated_by" uuid,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cars_plate_number_unique" UNIQUE("plate_number"),
	CONSTRAINT "cars_vin_unique" UNIQUE("vin"),
	CONSTRAINT "cars_year_chk" CHECK ("cars"."year" BETWEEN 1990 AND 2100),
	CONSTRAINT "cars_price_chk" CHECK ("cars"."daily_price" > 0),
	CONSTRAINT "cars_seats_chk" CHECK ("cars"."seats" BETWEEN 1 AND 20),
	CONSTRAINT "cars_deactivation_chk" CHECK ("cars"."status" = 'active' OR ("cars"."deactivation_reason" IS NOT NULL AND "cars"."deactivated_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "extras" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"price_per_day" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "extras_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "manager_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manager_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"public_id" text NOT NULL,
	"resource_type" varchar(16) DEFAULT 'image' NOT NULL,
	"format" varchar(16),
	"bytes" integer,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manager_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"manager_id" uuid NOT NULL,
	"event" "manager_event" NOT NULL,
	"reason" text,
	"changes" jsonb,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"civility" "civility" NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"first_name" varchar(120) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"whatsapp" varchar(32) NOT NULL,
	"city" varchar(120) NOT NULL,
	"birth_date" date NOT NULL,
	"marital_status" "marital_status",
	"work_start_date" date NOT NULL,
	"contract_type" "contract_type" NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"deactivation_reason" text,
	"deactivated_at" timestamp with time zone,
	"created_by" uuid,
	"admin_updated_at" timestamp with time zone,
	"admin_updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "managers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "managers_deactivation_reason_chk" CHECK ("managers"."status" = 'active' OR ("managers"."deactivation_reason" IS NOT NULL AND length(trim("managers"."deactivation_reason")) >= 3))
);
--> statement-breakpoint
CREATE TABLE "password_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "reservation_extras" (
	"reservation_id" uuid NOT NULL,
	"extra_id" integer NOT NULL,
	"quantity" smallint DEFAULT 1 NOT NULL,
	"unit_price_per_day" numeric(10, 2) NOT NULL,
	CONSTRAINT "reservation_extras_reservation_id_extra_id_pk" PRIMARY KEY("reservation_id","extra_id")
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(20) NOT NULL,
	"car_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"pickup_agency_id" integer NOT NULL,
	"return_agency_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" smallint NOT NULL,
	"daily_price" numeric(10, 2) NOT NULL,
	"extras_total" numeric(10, 2) DEFAULT 0 NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"deposit" numeric(10, 2) DEFAULT 0 NOT NULL,
	"status" "reservation_status" DEFAULT 'pending' NOT NULL,
	"driver_first_name" varchar(120) NOT NULL,
	"driver_last_name" varchar(120) NOT NULL,
	"driver_phone" varchar(32) NOT NULL,
	"driver_license_number" varchar(64) NOT NULL,
	"driver_birth_date" date NOT NULL,
	"flight_number" varchar(16),
	"client_note" text,
	"internal_note" text,
	"locale" "locale" DEFAULT 'fr' NOT NULL,
	"handled_by" uuid,
	"confirmed_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_reference_unique" UNIQUE("reference"),
	CONSTRAINT "reservations_dates_chk" CHECK ("reservations"."end_date" > "reservations"."start_date"),
	CONSTRAINT "reservations_total_chk" CHECK ("reservations"."total_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_preferences" (
	"user_id" uuid NOT NULL,
	"table_key" varchar(64) NOT NULL,
	"visible_columns" text[] NOT NULL,
	"page_size" smallint DEFAULT 25 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_preferences_user_id_table_key_pk" PRIMARY KEY("user_id","table_key"),
	CONSTRAINT "table_preferences_page_size_chk" CHECK ("table_preferences"."page_size" IN (25, 50, 100))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" varchar(255),
	"email_verified" timestamp with time zone,
	"image" text,
	"role" "role" DEFAULT 'client' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"password_hash" text,
	"phone" varchar(32),
	"preferred_locale" "locale",
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_images" ADD CONSTRAINT "car_images_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_translations" ADD CONSTRAINT "car_translations_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_deactivated_by_users_id_fk" FOREIGN KEY ("deactivated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_documents" ADD CONSTRAINT "manager_documents_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_documents" ADD CONSTRAINT "manager_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_events" ADD CONSTRAINT "manager_events_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_events" ADD CONSTRAINT "manager_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managers" ADD CONSTRAINT "managers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managers" ADD CONSTRAINT "managers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managers" ADD CONSTRAINT "managers_admin_updated_by_users_id_fk" FOREIGN KEY ("admin_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_tokens" ADD CONSTRAINT "password_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_extras" ADD CONSTRAINT "reservation_extras_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_extras" ADD CONSTRAINT "reservation_extras_extra_id_extras_id_fk" FOREIGN KEY ("extra_id") REFERENCES "public"."extras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_pickup_agency_id_agencies_id_fk" FOREIGN KEY ("pickup_agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_return_agency_id_agencies_id_fk" FOREIGN KEY ("return_agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_preferences" ADD CONSTRAINT "table_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "car_images_car_idx" ON "car_images" USING btree ("car_id","position");--> statement-breakpoint
CREATE INDEX "cars_status_idx" ON "cars" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cars_category_idx" ON "cars" USING btree ("category");--> statement-breakpoint
CREATE INDEX "cars_agency_idx" ON "cars" USING btree ("agency_id");--> statement-breakpoint
CREATE UNIQUE INDEX "manager_documents_kind_uq" ON "manager_documents" USING btree ("manager_id","kind");--> statement-breakpoint
CREATE INDEX "manager_events_manager_idx" ON "manager_events" USING btree ("manager_id","created_at");--> statement-breakpoint
CREATE INDEX "managers_status_idx" ON "managers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "managers_name_idx" ON "managers" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "password_tokens_user_idx" ON "password_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reservations_car_idx" ON "reservations" USING btree ("car_id","start_date");--> statement-breakpoint
CREATE INDEX "reservations_client_idx" ON "reservations" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "reservations_handled_idx" ON "reservations" USING btree ("handled_by","confirmed_at");--> statement-breakpoint
CREATE INDEX "reservations_status_idx" ON "reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");