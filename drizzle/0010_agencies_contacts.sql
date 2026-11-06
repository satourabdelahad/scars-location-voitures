ALTER TABLE "agencies" ADD COLUMN "whatsapp" varchar(32);--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "manager_civility" "civility";--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "manager_last_name" varchar(120);--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "manager_first_name" varchar(120);--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "manager_email" varchar(255);--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "manager_phone" varchar(32);--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "deactivation_reason" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
DROP TRIGGER IF EXISTS agencies_no_delete ON agencies;--> statement-breakpoint
CREATE TRIGGER agencies_no_delete BEFORE DELETE ON agencies
  FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();
