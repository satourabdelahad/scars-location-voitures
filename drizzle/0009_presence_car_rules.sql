CREATE TABLE "manager_car_rules" (
	"manager_id" uuid PRIMARY KEY NOT NULL,
	"brands" text[] DEFAULT '{}'::text[] NOT NULL,
	"cities" text[] DEFAULT '{}'::text[] NOT NULL,
	"car_count" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "car_managers" ADD COLUMN "source" varchar(16) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "manager_car_rules" ADD CONSTRAINT "manager_car_rules_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_car_rules" ADD CONSTRAINT "manager_car_rules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "manager_car_rules" ("manager_id", "car_count") SELECT m.id, (SELECT count(*)::int FROM car_managers cm WHERE cm.manager_id = m.id) FROM managers m ON CONFLICT ("manager_id") DO UPDATE SET "car_count" = EXCLUDED."car_count";
