import "server-only";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, clientProfiles, managers, users } from "@/db/schema";

/**
 * Segment d'un client, du plus actif au moins actif (un client n'est que dans un segment) :
 * renting = location en cours, negotiating = deal ouvert, rented = a déjà loué, never = jamais loué.
 */
export type ClientSegment = "renting" | "negotiating" | "rented" | "never";
export const CLIENT_SEGMENTS: ClientSegment[] = ["renting", "negotiating", "rented", "never"];

export async function listClients() {
  const res = await db.execute<{
    id: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    civility: "male" | "female" | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    city: string | null;
    status: "active" | "deactivated";
    created_at: string;
    last_login_at: string | null;
    preferred_locale: string | null;
    rentals: number;
    renting: boolean;
    open_deals: number;
    total_spent: string;
    last_rental: string | null;
    has_account: boolean;
    added_by: string | null;
    updated_at: string | null;
    blacklisted_at: string | null;
    blacklist_reason: string | null;
  }>(sql`
    SELECT u.id, u.name, p.first_name, p.last_name, p.civility, u.email, u.phone, p.whatsapp, p.city, u.status,
           u.created_at, u.last_login_at, u.preferred_locale, p.updated_at, p.blacklisted_at, p.blacklist_reason,
           (SELECT COALESCE(NULLIF(trim(sm.first_name || ' ' || sm.last_name), ''), su.name, su.email)
              FROM users su LEFT JOIN managers sm ON sm.user_id = su.id WHERE su.id = p.created_by) AS added_by,
           (u.password_hash IS NOT NULL OR EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id)) AS has_account,
           (SELECT count(*)::int FROM reservations r WHERE r.client_id = u.id AND r.status IN ('confirmed', 'ongoing', 'completed')) AS rentals,
           EXISTS (SELECT 1 FROM reservations r WHERE r.client_id = u.id
                   AND (r.status = 'ongoing' OR (r.status = 'confirmed' AND current_date >= r.start_date AND current_date < r.end_date))) AS renting,
           (SELECT count(*)::int FROM deals d WHERE d.client_id = u.id AND d.type IN ('prospect', 'question', 'negotiation', 'promotion')) AS open_deals,
           (SELECT coalesce(sum(r.total_price), 0) FROM reservations r WHERE r.client_id = u.id AND r.status IN ('confirmed', 'ongoing', 'completed')) AS total_spent,
           (SELECT max(r.start_date)::text FROM reservations r WHERE r.client_id = u.id AND r.status IN ('confirmed', 'ongoing', 'completed')) AS last_rental
    FROM users u
    LEFT JOIN client_profiles p ON p.user_id = u.id
    WHERE u.role = 'client'
    ORDER BY u.status, coalesce(p.last_name, u.name), p.first_name
  `);
  return res.rows.map((r) => {
    const segment: ClientSegment = r.renting ? "renting" : r.open_deals > 0 ? "negotiating" : r.rentals > 0 ? "rented" : "never";
    const [first, ...rest] = (r.name ?? "").split(" ");
    return {
      id: r.id,
      firstName: r.first_name ?? first ?? "",
      lastName: r.last_name ?? rest.join(" "),
      civility: r.civility,
      email: r.email,
      phone: r.phone,
      whatsapp: r.whatsapp,
      city: r.city,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
      lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
      locale: r.preferred_locale,
      rentals: r.rentals,
      openDeals: r.open_deals,
      totalSpent: Number(r.total_spent),
      lastRental: r.last_rental,
      hasAccount: r.has_account,
      addedBy: r.added_by,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      blacklisted: Boolean(r.blacklisted_at),
      blacklistReason: r.blacklist_reason,
      segment,
    };
  });
}
export type ClientRow = Awaited<ReturnType<typeof listClients>>[number];

export async function getClient(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const u = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.role, "client")),
    columns: { id: true, name: true, email: true, phone: true, status: true, image: true, preferredLocale: true, createdAt: true, lastLoginAt: true, passwordHash: true },
    with: { clientProfile: true },
  });
  if (!u) return null;
  const [first, ...rest] = (u.name ?? "").split(" ");
  const p = u.clientProfile;
  const [createdBy, updatedBy] = await Promise.all([staffName(p?.createdBy), staffName(p?.updatedBy)]);
  const { passwordHash, ...rest2 } = u;
  const [linked] = passwordHash ? [] : await db.select({ id: accounts.userId }).from(accounts).where(eq(accounts.userId, id)).limit(1);
  return {
    ...rest2,
    hasAccount: Boolean(passwordHash) || Boolean(linked),
    createdBy,
    updatedBy,
    updatedAt: p?.updatedAt ?? null,
    firstName: p?.firstName ?? first ?? "",
    lastName: p?.lastName ?? rest.join(" "),
    civility: p?.civility ?? null,
    whatsapp: p?.whatsapp ?? null,
    city: p?.city ?? null,
    birthDate: p?.birthDate ?? null,
    licenseNumber: p?.licenseNumber ?? null,
    notes: p?.notes ?? null,
    deactivationReason: p?.deactivationReason ?? null,
    licenseExpiresOn: p?.licenseExpiresOn ?? null,
    blacklistedAt: p?.blacklistedAt ?? null,
    blacklistReason: p?.blacklistReason ?? null,
    blacklistedBy: await staffName(p?.blacklistedBy),
  };
}
/** Nom complet et rôle d'un membre de l'équipe (auteur d'une création ou d'une modification). */
export async function staffName(userId: string | null | undefined) {
  if (!userId) return null;
  const [r] = await db
    .select({ name: users.name, email: users.email, role: users.role, first: managers.firstName, last: managers.lastName })
    .from(users)
    .leftJoin(managers, eq(managers.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!r) return null;
  return { name: r.first ? `${r.first} ${r.last}` : (r.name ?? r.email ?? "—"), role: r.role };
}

export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClient>>>;

/** Recherche rapide (rendez-vous, deals) : nom, email ou téléphone. */
export async function searchClientsQuery(q: string) {
  const term = `%${q.trim().replace(/[%_]/g, "")}%`;
  const digits = q.replace(/\D/g, "");
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, first: clientProfiles.firstName, last: clientProfiles.lastName })
    .from(users)
    .leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
    .where(
      and(
        eq(users.role, "client"),
        eq(users.status, "active"),
        or(
          ilike(users.name, term),
          ilike(users.email, term),
          ilike(clientProfiles.lastName, term),
          ilike(clientProfiles.firstName, term),
          ...(digits.length >= 4 ? [ilike(users.phone, `%${digits}%`)] : []),
        ),
      ),
    )
    .limit(8);
  return rows.map((r) => ({ id: r.id, name: r.first ? `${r.first} ${r.last}` : (r.name ?? r.email ?? "—"), email: r.email, phone: r.phone }));
}
export type ClientOption = Awaited<ReturnType<typeof searchClientsQuery>>[number];

/** Locations (toutes) d'un client, au format du tableau "Réalisations". */
export async function clientReservations(clientId: string) {
  const res = await db.execute<{
    id: string;
    reference: string;
    status: string;
    start_date: string;
    end_date: string;
    days: number;
    daily_price: string;
    extras_total: string;
    discount_amount: string;
    total_price: string;
    confirmed_at: string | null;
    brand: string;
    model: string;
    year: number;
    category: string;
    color_hex: string;
    plate_number: string;
    promo_code: string | null;
    promo_kind: "percent" | "amount" | null;
    promo_value: string | null;
    client: string;
    city: string;
    handler: string | null;
  }>(sql`
    SELECT r.id, r.reference, r.status, r.start_date::text, r.end_date::text, r.days,
           r.daily_price, r.extras_total, r.discount_amount, r.total_price, r.confirmed_at,
           c.brand, c.model, c.year, c.category, c.color_hex, c.plate_number,
           p.code AS promo_code, p.kind AS promo_kind, p.value AS promo_value,
           r.driver_first_name || ' ' || r.driver_last_name AS client, a.city, h.name AS handler
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    JOIN agencies a ON a.id = r.pickup_agency_id
    LEFT JOIN promotions p ON p.id = r.promotion_id
    LEFT JOIN users h ON h.id = r.handled_by
    WHERE r.client_id = ${clientId}
    ORDER BY r.start_date DESC
    LIMIT 500
  `);
  return res.rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    status: r.status as "confirmed" | "ongoing" | "completed",
    startDate: r.start_date,
    endDate: r.end_date,
    days: r.days,
    dailyPrice: Number(r.daily_price),
    extrasTotal: Number(r.extras_total),
    discount: Number(r.discount_amount),
    total: Number(r.total_price),
    confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).toISOString() : null,
    car: `${r.brand} ${r.model}`,
    year: r.year,
    category: r.category,
    colorHex: r.color_hex,
    plate: r.plate_number,
    promotion: r.promo_code ? { code: r.promo_code, kind: r.promo_kind!, value: Number(r.promo_value) } : null,
    client: r.client,
    city: r.city,
    handler: r.handler,
  }));
}
