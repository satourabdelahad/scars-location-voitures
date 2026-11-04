ALTER TYPE "public"."transmission" ADD VALUE 'semi_automatic';--> statement-breakpoint
ALTER TABLE "cars" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."car_category";--> statement-breakpoint
CREATE TYPE "public"."car_category" AS ENUM('city_car', 'micro_car', 'compact', 'sedan', 'estate', 'coupe', 'cabriolet', 'cc', 'suv_4x4', 'crossover', 'mpv', 'pickup', 'minivan', 'van');--> statement-breakpoint
-- Anciennes catégories -> carrosseries du cahier des charges (sans UPDATE : les voitures désactivées sont figées par trigger)
ALTER TABLE "cars" ALTER COLUMN "category" SET DATA TYPE "public"."car_category" USING (CASE "category"
  WHEN 'economy' THEN 'city_car'
  WHEN 'suv' THEN 'suv_4x4'
  WHEN 'luxury' THEN 'sedan'
  WHEN 'convertible' THEN 'cabriolet'
  ELSE "category" END)::"public"."car_category";--> statement-breakpoint
ALTER TABLE "cars" ALTER COLUMN "fuel" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."fuel";--> statement-breakpoint
CREATE TYPE "public"."fuel" AS ENUM('petrol', 'diesel', 'electric', 'hybrid', 'plug_in_hybrid');--> statement-breakpoint
ALTER TABLE "cars" ALTER COLUMN "fuel" SET DATA TYPE "public"."fuel" USING "fuel"::"public"."fuel";--> statement-breakpoint
ALTER TABLE "cars" ADD COLUMN "purchase_city" varchar(120);--> statement-breakpoint
ALTER TABLE "cars" ADD COLUMN "purchase_date" date;--> statement-breakpoint
ALTER TABLE "cars" ADD COLUMN "purchase_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "managers" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "managers" ADD COLUMN "photo_public_id" text;--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_purchase_price_chk" CHECK ("cars"."purchase_price" IS NULL OR "cars"."purchase_price" >= 0);