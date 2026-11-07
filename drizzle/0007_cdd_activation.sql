ALTER TYPE "public"."manager_event" ADD VALUE 'activated';--> statement-breakpoint
ALTER TABLE "managers" ALTER COLUMN "contract_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."contract_type";--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('cdi', 'cdd', 'freelance');--> statement-breakpoint
ALTER TABLE "managers" ALTER COLUMN "contract_type" SET DATA TYPE "public"."contract_type" USING "contract_type"::"public"."contract_type";