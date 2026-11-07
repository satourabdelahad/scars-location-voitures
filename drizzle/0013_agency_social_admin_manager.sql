ALTER TABLE "agencies" ADD COLUMN "website_url" varchar(300);--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "facebook_url" varchar(300);--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "instagram_url" varchar(300);--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "linkedin_url" varchar(300);--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "x_url" varchar(300);--> statement-breakpoint
-- L'administrateur a aussi une fiche gestionnaire (il apparaît dans les listes, peut être responsable
-- d'agence ou suivre des voitures). Ses coordonnées viennent de son profil administrateur.
INSERT INTO "managers" ("user_id", "civility", "last_name", "first_name", "phone", "whatsapp", "city", "birth_date", "marital_status", "work_start_date", "contract_type", "photo_url", "status")
SELECT u.id,
       COALESCE(ap.civility, 'male'),
       COALESCE(NULLIF(ap.last_name, ''), NULLIF(substring(u.name from position(' ' in u.name) + 1), ''), 'Administrateur'),
       COALESCE(NULLIF(ap.first_name, ''), NULLIF(split_part(u.name, ' ', 1), ''), 'Admin'),
       COALESCE(u.phone, ''),
       COALESCE(ap.whatsapp, u.phone, ''),
       COALESCE(ap.city, ''),
       COALESCE(ap.birth_date, DATE '1990-01-01'),
       ap.marital_status,
       u.created_at::date,
       'cdi',
       u.image,
       'active'
FROM "users" u
LEFT JOIN "admin_profiles" ap ON ap.user_id = u.id
WHERE u.role = 'admin' AND NOT EXISTS (SELECT 1 FROM "managers" m WHERE m.user_id = u.id);
