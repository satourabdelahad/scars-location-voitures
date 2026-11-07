CREATE TYPE "public"."deal_source" AS ENUM('website', 'phone', 'whatsapp', 'walk_in', 'social', 'referral', 'other');--> statement-breakpoint
CREATE TYPE "public"."deal_type" AS ENUM('prospect', 'negotiation', 'rental', 'cancellation', 'promotion');--> statement-breakpoint
CREATE TYPE "public"."promotion_kind" AS ENUM('percent', 'amount');--> statement-breakpoint
CREATE TABLE "deal_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"from_type" "deal_type",
	"to_type" "deal_type",
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manager_id" uuid NOT NULL,
	"type" "deal_type" DEFAULT 'prospect' NOT NULL,
	"prospect_name" varchar(160) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"email" varchar(255),
	"city" varchar(120),
	"source" "deal_source" DEFAULT 'other' NOT NULL,
	"car_id" uuid,
	"promotion_id" integer,
	"reservation_id" uuid,
	"amount" numeric(10, 2),
	"expected_date" date,
	"next_follow_up" date,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_amount_chk" CHECK ("deals"."amount" IS NULL OR "deals"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"label" varchar(160) NOT NULL,
	"kind" "promotion_kind" NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"min_days" smallint DEFAULT 1 NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_code_unique" UNIQUE("code"),
	CONSTRAINT "promotions_value_chk" CHECK ("promotions"."value" > 0 AND ("promotions"."kind" = 'amount' OR "promotions"."value" <= 100)),
	CONSTRAINT "promotions_dates_chk" CHECK ("promotions"."starts_on" IS NULL OR "promotions"."ends_on" IS NULL OR "promotions"."ends_on" >= "promotions"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "promotion_id" integer;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "discount_amount" numeric(10, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_events_deal_idx" ON "deal_events" USING btree ("deal_id","created_at");--> statement-breakpoint
CREATE INDEX "deal_events_actor_idx" ON "deal_events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "deals_manager_idx" ON "deals" USING btree ("manager_id","updated_at");--> statement-breakpoint
CREATE INDEX "deals_type_idx" ON "deals" USING btree ("type");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_discount_chk" CHECK ("reservations"."discount_amount" >= 0);--> statement-breakpoint
-- Les deals du CRM ne sont jamais supprimés : on change leur type d'accord (ex. annulation).
CREATE TRIGGER deals_no_delete BEFORE DELETE ON deals
  FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();
