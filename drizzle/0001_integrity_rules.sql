-- Règles métier garanties par PostgreSQL lui-même (et pas seulement par l'application).

-- 1. Aucune suppression de gestionnaire ni de voiture : on désactive seulement.
CREATE OR REPLACE FUNCTION scar_forbid_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Suppression interdite sur % : utilisez la désactivation', TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER managers_no_delete BEFORE DELETE ON managers
  FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();
--> statement-breakpoint
CREATE TRIGGER cars_no_delete BEFORE DELETE ON cars
  FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();
--> statement-breakpoint
CREATE TRIGGER reservations_no_delete BEFORE DELETE ON reservations
  FOR EACH ROW EXECUTE FUNCTION scar_forbid_delete();
--> statement-breakpoint

-- 2. Une voiture désactivée est figée : plus aucune modification possible.
CREATE OR REPLACE FUNCTION scar_freeze_deactivated_car() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'deactivated' THEN
    RAISE EXCEPTION 'La voiture % est désactivée et ne peut plus être modifiée', OLD.plate_number
      USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER cars_freeze_deactivated BEFORE UPDATE ON cars
  FOR EACH ROW EXECUTE FUNCTION scar_freeze_deactivated_car();
--> statement-breakpoint

-- Photos et descriptions d'une voiture désactivée : figées elles aussi.
CREATE OR REPLACE FUNCTION scar_freeze_car_children() RETURNS trigger AS $$
DECLARE
  car_status text;
BEGIN
  SELECT status INTO car_status FROM cars WHERE id = COALESCE(NEW.car_id, OLD.car_id);
  IF car_status = 'deactivated' THEN
    RAISE EXCEPTION 'La voiture est désactivée et ne peut plus être modifiée' USING ERRCODE = 'P0002';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER car_images_freeze BEFORE INSERT OR UPDATE OR DELETE ON car_images
  FOR EACH ROW EXECUTE FUNCTION scar_freeze_car_children();
--> statement-breakpoint
CREATE TRIGGER car_translations_freeze BEFORE INSERT OR UPDATE OR DELETE ON car_translations
  FOR EACH ROW EXECUTE FUNCTION scar_freeze_car_children();
--> statement-breakpoint

-- 3. Pas de double réservation : deux réservations actives d'une même voiture ne peuvent pas se chevaucher.
--    La période est [start_date, end_date) : la voiture rendue le jour J peut repartir le jour J.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE reservations ADD CONSTRAINT reservations_no_overlap
  EXCLUDE USING gist (
    car_id WITH =,
    daterange(start_date, end_date, '[)') WITH &&
  ) WHERE (status IN ('pending', 'confirmed', 'ongoing'));
--> statement-breakpoint

-- 4. On ne réserve pas une voiture désactivée.
CREATE OR REPLACE FUNCTION scar_reservation_requires_active_car() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM cars WHERE id = NEW.car_id AND status = 'deactivated') THEN
    RAISE EXCEPTION 'Cette voiture n''est plus disponible' USING ERRCODE = 'P0003';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER reservations_active_car BEFORE INSERT ON reservations
  FOR EACH ROW EXECUTE FUNCTION scar_reservation_requires_active_car();
--> statement-breakpoint

-- 5. Références lisibles de réservation : SCR-2026-000001
CREATE SEQUENCE IF NOT EXISTS reservation_ref_seq START 1;
