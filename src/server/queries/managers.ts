import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { managerDocuments, managerEvents, managers } from "@/db/schema";

const TZ = "Africa/Casablanca";
const RENTED = sql`('confirmed','ongoing','completed')`;

/**
 * Liste des gestionnaires avec leurs compteurs de locations.
 * Une "voiture louée" = une réservation confirmée par ce gestionnaire (confirmée, en cours ou terminée),
 * comptée à la date de confirmation, en heure du Maroc. Semaine = semaine ISO (lundi).
 */
export async function listManagersWithStats() {
  const rows = await db.execute<{
    id: string;
    user_id: string;
    civility: "male" | "female";
    last_name: string;
    first_name: string;
    email: string;
    phone: string;
    whatsapp: string;
    city: string;
    birth_date: string;
    marital_status: "married" | "widowed" | "single" | null;
    work_start_date: string;
    contract_type: "cdi" | "cdd" | "freelance";
    photo_url: string | null;
    locked_until: string | null;
    status: "active" | "deactivated";
    deactivation_reason: string | null;
    deactivated_at: string | null;
    last_login_at: string | null;
    admin_updated_at: string | null;
    rentals_day: number;
    rentals_week: number;
    rentals_month: number;
    rentals_year: number;
    assigned_cars: string[] | null;
    has_password: boolean;
    is_admin: boolean;
  }>(sql`
    WITH bounds AS (
      SELECT
        date_trunc('day',   now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ} AS d,
        date_trunc('week',  now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ} AS w,
        date_trunc('month', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ} AS m,
        date_trunc('year',  now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ} AS y
    )
    SELECT
      m.id, m.user_id, m.civility, m.last_name, m.first_name, u.email, m.phone, m.whatsapp, m.city,
      m.birth_date::text, m.marital_status, m.work_start_date::text, m.contract_type, m.photo_url, m.status,
      m.deactivation_reason, m.deactivated_at, u.last_login_at, m.admin_updated_at, (u.password_hash IS NOT NULL) AS has_password, (u.role = 'admin') AS is_admin,
      CASE WHEN u.login_locked_until > now() THEN u.login_locked_until END AS locked_until,
      count(r.id) FILTER (WHERE r.confirmed_at >= b.d)::int AS rentals_day,
      count(r.id) FILTER (WHERE r.confirmed_at >= b.w)::int AS rentals_week,
      count(r.id) FILTER (WHERE r.confirmed_at >= b.m)::int AS rentals_month,
      count(r.id) FILTER (WHERE r.confirmed_at >= b.y)::int AS rentals_year,
      (SELECT array_agg(c.brand || ' ' || c.model || ' ' || c.year || ' (' || c.plate_number || ')' ORDER BY c.brand, c.model)
         FROM car_managers cm JOIN cars c ON c.id = cm.car_id WHERE cm.manager_id = m.id) AS assigned_cars
    FROM managers m
    JOIN users u ON u.id = m.user_id
    CROSS JOIN bounds b
    LEFT JOIN reservations r
      ON r.handled_by = m.user_id AND r.status IN ${RENTED} AND r.confirmed_at >= LEAST(b.y, b.w) AND r.confirmed_at <= now()
    GROUP BY m.id, u.id
    ORDER BY (u.role = 'admin') DESC, m.status, m.last_name, m.first_name
  `);
  return rows.rows.map((r) => ({
    id: r.id,
    civility: r.civility,
    lastName: r.last_name,
    firstName: r.first_name,
    photoUrl: r.photo_url,
    lockedUntil: r.locked_until ? new Date(r.locked_until).toISOString() : null,
    email: r.email,
    phone: r.phone,
    whatsapp: r.whatsapp,
    city: r.city,
    birthDate: r.birth_date,
    maritalStatus: r.marital_status,
    workStartDate: r.work_start_date,
    contractType: r.contract_type,
    status: r.status,
    deactivationReason: r.deactivation_reason,
    lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
    adminUpdatedAt: r.admin_updated_at ? new Date(r.admin_updated_at).toISOString() : null,
    rentalsDay: r.rentals_day,
    rentalsWeek: r.rentals_week,
    rentalsMonth: r.rentals_month,
    rentalsYear: r.rentals_year,
    assignedCars: r.assigned_cars ?? [],
    hasPassword: r.has_password,
    /** L'administrateur figure aussi parmi les gestionnaires (non désactivable, pas d'invitation). */
    isAdmin: r.is_admin,
  }));
}
export type ManagerRow = Awaited<ReturnType<typeof listManagersWithStats>>[number];

/** Locations confirmées par jour et par gestionnaire sur les 30 derniers jours. */
export async function managersDailyTrend(days = 30) {
  const res = await db.execute<{ day: string; manager_id: string; n: number }>(sql`
    SELECT to_char(g.day, 'YYYY-MM-DD') AS day, m.id AS manager_id,
           count(r.id)::int AS n
    FROM generate_series(
           (now() AT TIME ZONE 'Africa/Casablanca')::date - ${days - 1}::int,
           (now() AT TIME ZONE 'Africa/Casablanca')::date, interval '1 day') AS g(day)
    CROSS JOIN managers m
    LEFT JOIN reservations r
      ON r.handled_by = m.user_id AND r.status IN ${RENTED}
     AND (r.confirmed_at AT TIME ZONE 'Africa/Casablanca')::date = g.day::date
    WHERE m.status = 'active'
    GROUP BY g.day, m.id
    ORDER BY g.day
  `);
  return res.rows;
}

export async function getManager(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const m = await db.query.managers.findFirst({
    where: eq(managers.id, id),
    with: {
      user: { columns: { email: true, role: true, lastLoginAt: true, passwordHash: true, status: true, loginLockedUntil: true } },
      documents: { orderBy: [asc(managerDocuments.kind)] },
      events: { orderBy: [desc(managerEvents.createdAt)], with: { actor: { columns: { name: true, email: true } } } },
    },
  });
  if (!m) return null;
  const { passwordHash, ...user } = m.user;
  return { ...m, user: { ...user, hasPassword: Boolean(passwordHash) } };
}
export type ManagerDetail = NonNullable<Awaited<ReturnType<typeof getManager>>>;

export async function managerRentalCounts(userId: string) {
  const [row] = (
    await db.execute<{ d: number; w: number; m: number; y: number; total: number }>(sql`
      SELECT
        count(*) FILTER (WHERE confirmed_at >= date_trunc('day',   now() AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'Africa/Casablanca')::int AS d,
        count(*) FILTER (WHERE confirmed_at >= date_trunc('week',  now() AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'Africa/Casablanca')::int AS w,
        count(*) FILTER (WHERE confirmed_at >= date_trunc('month', now() AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'Africa/Casablanca')::int AS m,
        count(*) FILTER (WHERE confirmed_at >= date_trunc('year',  now() AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'Africa/Casablanca')::int AS y,
        count(*)::int AS total
      FROM reservations WHERE handled_by = ${userId} AND status IN ${RENTED} AND confirmed_at <= now()
    `)
  ).rows;
  return row;
}

