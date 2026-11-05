import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Agences pour « Mes agences » (actives et désactivées), avec le nombre de voitures rattachées. */
export async function listAgencies() {
  const res = await db.execute<{
    id: number;
    name: string;
    city: string;
    address: string;
    phone: string | null;
    whatsapp: string | null;
    is_airport: boolean;
    is_active: boolean;
    manager_id: string | null;
    manager_civility: "male" | "female" | null;
    manager_last_name: string | null;
    manager_first_name: string | null;
    manager_email: string | null;
    manager_phone: string | null;
    deactivation_reason: string | null;
    cars: number;
    updated_at: string;
  }>(sql`
    SELECT a.id, a.name, a.city, a.address, a.phone, a.whatsapp, a.is_airport, a.is_active,
           a.manager_id, a.manager_civility, a.manager_last_name, a.manager_first_name, a.manager_email, a.manager_phone,
           a.deactivation_reason, a.updated_at,
           (SELECT count(*)::int FROM cars c WHERE c.agency_id = a.id AND c.status <> 'deactivated') AS cars
    FROM agencies a
    ORDER BY a.is_active DESC, a.city, a.name
  `);
  return res.rows.map((r) => ({
    id: String(r.id),
    agencyId: r.id,
    name: r.name,
    city: r.city,
    address: r.address,
    phone: r.phone,
    whatsapp: r.whatsapp,
    isAirport: r.is_airport,
    isActive: r.is_active,
    managerId: r.manager_id,
    managerCivility: r.manager_civility,
    managerLastName: r.manager_last_name,
    managerFirstName: r.manager_first_name,
    managerEmail: r.manager_email,
    managerPhone: r.manager_phone,
    deactivationReason: r.deactivation_reason,
    cars: r.cars,
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}
export type AgencyRow = Awaited<ReturnType<typeof listAgencies>>[number];

export async function getAgency(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return (await listAgencies()).find((a) => a.agencyId === id) ?? null;
}

/** Statistiques d'une agence (onglet « Statistiques ») : voitures, locations au départ de l'agence, chiffre d'affaires. */
export async function agencyStats(id: number) {
  const res = await db.execute<{ cars: number; maintenance: number; on_road: number; rentals: number; revenue: string; rentals_30: number; revenue_30: string }>(sql`
    SELECT
      (SELECT count(*)::int FROM cars c WHERE c.agency_id = ${id} AND c.status <> 'deactivated') AS cars,
      (SELECT count(*)::int FROM cars c WHERE c.agency_id = ${id} AND c.status = 'maintenance') AS maintenance,
      (SELECT count(DISTINCT r.car_id)::int FROM reservations r JOIN cars c ON c.id = r.car_id
        WHERE c.agency_id = ${id} AND (r.status = 'ongoing' OR (r.status = 'confirmed' AND CURRENT_DATE >= r.start_date AND CURRENT_DATE < r.end_date))) AS on_road,
      count(r.id)::int AS rentals,
      coalesce(sum(r.total_price), 0) AS revenue,
      count(r.id) FILTER (WHERE r.start_date >= CURRENT_DATE - 30)::int AS rentals_30,
      coalesce(sum(r.total_price) FILTER (WHERE r.start_date >= CURRENT_DATE - 30), 0) AS revenue_30
    FROM reservations r
    WHERE r.pickup_agency_id = ${id} AND r.status IN ('confirmed', 'ongoing', 'completed')
  `);
  const r = res.rows[0];
  return {
    cars: r?.cars ?? 0,
    maintenance: r?.maintenance ?? 0,
    onRoad: r?.on_road ?? 0,
    rentals: r?.rentals ?? 0,
    revenue: Number(r?.revenue ?? 0),
    rentals30: r?.rentals_30 ?? 0,
    revenue30: Number(r?.revenue_30 ?? 0),
  };
}

/**
 * Gestionnaires liés à une agence : son responsable, ceux affectés à ses voitures
 * et ceux dont la règle d'affectation vise cette agence.
 */
export async function agencyManagers(id: number) {
  const res = await db.execute<{ id: string; first_name: string; last_name: string; photo_url: string | null; city: string; phone: string; email: string | null; status: string; responsible: boolean; by_rule: boolean; cars: number }>(sql`
    SELECT m.id, m.first_name, m.last_name, m.photo_url, m.city, m.phone, u.email, m.status,
           (a.manager_id = m.id) AS responsible,
           (${id} = ANY(coalesce(r.agencies, '{}'))) AS by_rule,
           (SELECT count(*)::int FROM car_managers cm JOIN cars c ON c.id = cm.car_id WHERE cm.manager_id = m.id AND c.agency_id = ${id}) AS cars
    FROM managers m
    JOIN users u ON u.id = m.user_id
    JOIN agencies a ON a.id = ${id}
    LEFT JOIN manager_car_rules r ON r.manager_id = m.id
    WHERE a.manager_id = m.id
       OR ${id} = ANY(coalesce(r.agencies, '{}'))
       OR EXISTS (SELECT 1 FROM car_managers cm JOIN cars c ON c.id = cm.car_id WHERE cm.manager_id = m.id AND c.agency_id = ${id})
    ORDER BY (a.manager_id = m.id) DESC, m.last_name, m.first_name
  `);
  return res.rows.map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    photoUrl: r.photo_url,
    city: r.city,
    phone: r.phone,
    email: r.email,
    active: r.status === "active",
    responsible: r.responsible,
    byRule: r.by_rule,
    cars: r.cars,
  }));
}

/** Gestionnaires proposés comme responsable d'agence. */
export async function managerChoices() {
  const res = await db.execute<{ id: string; first_name: string; last_name: string; civility: "male" | "female"; email: string | null; phone: string; photo_url: string | null; status: string }>(sql`
    SELECT m.id, m.first_name, m.last_name, m.civility, u.email, m.phone, m.photo_url, m.status
    FROM managers m JOIN users u ON u.id = m.user_id
    ORDER BY m.last_name, m.first_name
  `);
  return res.rows.map((r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, civility: r.civility, email: r.email, phone: r.phone, photoUrl: r.photo_url, active: r.status === "active" }));
}
