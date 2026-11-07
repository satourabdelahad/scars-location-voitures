CREATE TABLE "app_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "car_managers" (
	"car_id" uuid NOT NULL,
	"manager_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "car_managers_car_id_manager_id_pk" PRIMARY KEY("car_id","manager_id")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "login_failures" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "login_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_managers" ADD CONSTRAINT "car_managers_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_managers" ADD CONSTRAINT "car_managers_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "car_managers_manager_idx" ON "car_managers" USING btree ("manager_id");