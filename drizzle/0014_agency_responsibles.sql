ALTER TABLE "manager_agencies" ADD COLUMN "is_responsible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Le responsable unique d'avant devient un responsable parmi d'autres possibles.
INSERT INTO "manager_agencies" ("manager_id", "agency_id", "is_responsible")
SELECT a.manager_id, a.id, true FROM "agencies" a WHERE a.manager_id IS NOT NULL
ON CONFLICT ("manager_id", "agency_id") DO UPDATE SET "is_responsible" = true;
