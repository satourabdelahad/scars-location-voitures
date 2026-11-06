CREATE TABLE "admin_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"civility" "civility",
	"first_name" varchar(120),
	"last_name" varchar(120),
	"whatsapp" varchar(32),
	"city" varchar(120),
	"birth_date" date,
	"marital_status" "marital_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "manager_id" uuid;--> statement-breakpoint
ALTER TABLE "car_images" ADD COLUMN "view" varchar(16) DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "manager_car_rules" ADD COLUMN "agencies" integer[] DEFAULT '{}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
UPDATE "car_images" SET "view" = 'main' WHERE "position" = 0;--> statement-breakpoint
DROP TRIGGER IF EXISTS admin_profiles_no_delete ON admin_profiles;--> statement-breakpoint
CREATE TRIGGER admin_profiles_no_delete BEFORE DELETE ON admin_profiles
  FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();
