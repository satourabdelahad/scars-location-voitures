CREATE TABLE "car_agencies" (
	"car_id" uuid NOT NULL,
	"agency_id" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "car_agencies_car_id_agency_id_pk" PRIMARY KEY("car_id","agency_id")
);
--> statement-breakpoint
CREATE TABLE "car_responsibles" (
	"car_id" uuid NOT NULL,
	"manager_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "car_responsibles_car_id_manager_id_pk" PRIMARY KEY("car_id","manager_id")
);
--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "tiktok_url" varchar(300);--> statement-breakpoint
ALTER TABLE "car_agencies" ADD CONSTRAINT "car_agencies_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_agencies" ADD CONSTRAINT "car_agencies_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_agencies" ADD CONSTRAINT "car_agencies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_responsibles" ADD CONSTRAINT "car_responsibles_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_responsibles" ADD CONSTRAINT "car_responsibles_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_responsibles" ADD CONSTRAINT "car_responsibles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "car_agencies_agency_idx" ON "car_agencies" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "car_responsibles_manager_idx" ON "car_responsibles" USING btree ("manager_id");