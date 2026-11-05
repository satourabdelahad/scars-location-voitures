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
           a.manager_civility, a.manager_last_name, a.manager_first_name, a.manager_email, a.manager_phone,
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
