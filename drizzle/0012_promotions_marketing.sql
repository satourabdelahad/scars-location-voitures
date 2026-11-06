CREATE TABLE "client_promotions" (
	"client_id" uuid NOT NULL,
	"promotion_id" integer NOT NULL,
	"campaign_id" integer,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	"reservation_id" uuid,
	CONSTRAINT "client_promotions_client_id_promotion_id_pk" PRIMARY KEY("client_id","promotion_id")
);
--> statement-breakpoint
CREATE TABLE "manager_agencies" (
	"manager_id" uuid NOT NULL,
	"agency_id" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manager_agencies_manager_id_agency_id_pk" PRIMARY KEY("manager_id","agency_id")
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"message" text,
	"promotion_id" integer NOT NULL,
	"filters" jsonb NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_recipients" (
	"campaign_id" integer NOT NULL,
	"client_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"email" varchar(255) NOT NULL,
	"sent_at" timestamp with time zone,
	"failed" boolean DEFAULT false NOT NULL,
	"clicked_at" timestamp with time zone,
	CONSTRAINT "marketing_recipients_campaign_id_client_id_pk" PRIMARY KEY("campaign_id","client_id"),
	CONSTRAINT "marketing_recipients_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "driver_license_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "driver_birth_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cars" ADD COLUMN "promo_percent" smallint;--> statement-breakpoint
ALTER TABLE "cars" ADD COLUMN "promo_starts_on" date;--> statement-breakpoint
ALTER TABLE "cars" ADD COLUMN "promo_ends_on" date;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "restricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "car_promo_percent" smallint;--> statement-breakpoint
ALTER TABLE "client_promotions" ADD CONSTRAINT "client_promotions_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_promotions" ADD CONSTRAINT "client_promotions_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_promotions" ADD CONSTRAINT "client_promotions_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_promotions" ADD CONSTRAINT "client_promotions_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_agencies" ADD CONSTRAINT "manager_agencies_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_agencies" ADD CONSTRAINT "manager_agencies_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_agencies" ADD CONSTRAINT "manager_agencies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_recipients" ADD CONSTRAINT "marketing_recipients_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_recipients" ADD CONSTRAINT "marketing_recipients_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manager_agencies_agency_idx" ON "manager_agencies" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "marketing_recipients_client_idx" ON "marketing_recipients" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_promo_chk" CHECK ("cars"."promo_percent" IS NULL OR "cars"."promo_percent" BETWEEN 1 AND 90);--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_promo_dates_chk" CHECK ("cars"."promo_starts_on" IS NULL OR "cars"."promo_ends_on" IS NULL OR "cars"."promo_ends_on" >= "cars"."promo_starts_on");--> statement-breakpoint
DROP TRIGGER IF EXISTS marketing_campaigns_no_delete ON marketing_campaigns;--> statement-breakpoint
CREATE TRIGGER marketing_campaigns_no_delete BEFORE DELETE ON marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();--> statement-breakpoint
DROP TRIGGER IF EXISTS marketing_recipients_no_delete ON marketing_recipients;--> statement-breakpoint
CREATE TRIGGER marketing_recipients_no_delete BEFORE DELETE ON marketing_recipients
  FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();--> statement-breakpoint
DROP TRIGGER IF EXISTS client_promotions_no_delete ON client_promotions;--> statement-breakpoint
CREATE TRIGGER client_promotions_no_delete BEFORE DELETE ON client_promotions
  FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();
