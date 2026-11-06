import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Responsable d'agence (0, 1 ou plusieurs par agence). */
export type Responsible = { id: string; civility: "male" | "female"; firstName: string; lastName: string; phone: string; email: string | null; photoUrl: string | null; active: boolean };

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
    responsibles: Responsible[] | null;
    deactivation_reason: string | null;
    website_url: string | null;
    facebook_url: string | null;
    instagram_url: string | null;
    linkedin_url: string | null;
    x_url: string | null;
    cars: number;
    updated_at: string;
  }>(sql`
    SELECT a.id, a.name, a.city, a.address, a.phone, a.whatsapp, a.is_airport, a.is_active,
           (SELECT json_agg(json_build_object('id', m.id, 'civility', m.civility, 'firstName', m.first_name, 'lastName', m.last_name,
                                     'phone', m.phone, 'email', u.email, 'photoUrl', m.photo_url, 'active', m.status = 'active')
                    ORDER BY m.last_name, m.first_name)
              FROM manager_agencies ma JOIN managers m ON m.id = ma.manager_id JOIN users u ON u.id = m.user_id
             WHERE ma.agency_id = a.id AND ma.is_responsible) AS responsibles,
           a.deactivation_reason, a.updated_at, a.website_url, a.facebook_url, a.instagram_url, a.linkedin_url, a.x_url,
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
    responsibles: r.responsibles ?? [],
    deactivationReason: r.deactivation_reason,
    websiteUrl: r.website_url,
    facebookUrl: r.facebook_url,
    instagramUrl: r.instagram_url,
    linkedinUrl: r.linkedin_url,
    xUrl: r.x_url,
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
 * Gestionnaires liés à une agence : son responsable, ceux rattachés à l'agence, ceux affectés à ses voitures
 * et ceux dont la règle d'affectation vise cette agence.
 */
export async function agencyManagers(id: number) {
  const res = await db.execute<{ id: string; first_name: string; last_name: string; photo_url: string | null; city: string; phone: string; email: string | null; status: string; responsible: boolean; member: boolean; is_admin: boolean; by_rule: boolean; cars: number }>(sql`
    SELECT m.id, m.first_name, m.last_name, m.photo_url, m.city, m.phone, u.email, m.status,
           EXISTS (SELECT 1 FROM manager_agencies ma WHERE ma.manager_id = m.id AND ma.agency_id = ${id} AND ma.is_responsible) AS responsible,
           (u.role = 'admin' OR EXISTS (SELECT 1 FROM manager_agencies ma WHERE ma.manager_id = m.id AND ma.agency_id = ${id})) AS member,
           (u.role = 'admin') AS is_admin,
           (${id} = ANY(coalesce(r.agencies, '{}'))) AS by_rule,
           (SELECT count(*)::int FROM car_managers cm JOIN cars c ON c.id = cm.car_id WHERE cm.manager_id = m.id AND c.agency_id = ${id}) AS cars
    FROM managers m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN manager_car_rules r ON r.manager_id = m.id
    WHERE u.role = 'admin'
       OR EXISTS (SELECT 1 FROM manager_agencies ma WHERE ma.manager_id = m.id AND ma.agency_id = ${id})
       OR ${id} = ANY(coalesce(r.agencies, '{}'))
       OR EXISTS (SELECT 1 FROM car_managers cm JOIN cars c ON c.id = cm.car_id WHERE cm.manager_id = m.id AND c.agency_id = ${id})
    ORDER BY responsible DESC, is_admin DESC, m.last_name, m.first_name
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
    member: r.member,
    isAdmin: r.is_admin,
    byRule: r.by_rule,
    cars: r.cars,
  }));
}

/** Gestionnaires proposés comme responsable d'agence. */
export async function managerChoices() {
  const res = await db.execute<{ id: string; first_name: string; last_name: string; civility: "male" | "female"; email: string | null; phone: string; photo_url: string | null; status: string; is_admin: boolean }>(sql`
    SELECT m.id, m.first_name, m.last_name, m.civility, u.email, m.phone, m.photo_url, m.status, (u.role = 'admin') AS is_admin
    FROM managers m JOIN users u ON u.id = m.user_id
    ORDER BY (u.role = 'admin') DESC, m.last_name, m.first_name
  `);
  return res.rows.map((r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, civility: r.civility, email: r.email, phone: r.phone, photoUrl: r.photo_url, active: r.status === "active", isAdmin: r.is_admin }));
}

/** Agences d'un gestionnaire : celles dont il est responsable et celles où il est rattaché. */
export async function managerAgencyLinks(managerId: string) {
  const res = await db.execute<{ id: number; name: string; city: string; is_active: boolean; is_airport: boolean; responsible: boolean; member: boolean; cars: number; head: string | null }>(sql`
    SELECT a.id, a.name, a.city, a.is_active, a.is_airport,
           (SELECT count(*)::int FROM cars c WHERE c.agency_id = a.id AND c.status <> 'deactivated') AS cars,
           (SELECT string_agg(m2.first_name || ' ' || m2.last_name, ', ' ORDER BY m2.last_name)
              FROM manager_agencies ma2 JOIN managers m2 ON m2.id = ma2.manager_id
             WHERE ma2.agency_id = a.id AND ma2.is_responsible) AS head,
           EXISTS (SELECT 1 FROM manager_agencies ma WHERE ma.manager_id = ${managerId} AND ma.agency_id = a.id AND ma.is_responsible) AS responsible,
           (EXISTS (SELECT 1 FROM managers m JOIN users u ON u.id = m.user_id WHERE m.id = ${managerId} AND u.role = 'admin')
             OR EXISTS (SELECT 1 FROM manager_agencies ma WHERE ma.manager_id = ${managerId} AND ma.agency_id = a.id)) AS member
    FROM agencies a
    ORDER BY a.city, a.name
  `);
  return res.rows.map((r) => ({
    id: r.id,
    label: `${r.city}, ${r.name}`,
    active: r.is_active,
    airport: r.is_airport,
    responsible: Boolean(r.responsible),
    member: r.member,
    cars: r.cars,
    head: r.head,
  }));
}
