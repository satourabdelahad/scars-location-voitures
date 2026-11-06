import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { currentAgencyScope } from "@/server/agency-scope";
import { cars, dealEvents, deals, managers, promotions } from "@/db/schema";
import type { SessionUser } from "@/server/guards";

/** Admin : n'importe quel gestionnaire. Gestionnaire : uniquement sa propre fiche. */
export async function canViewManager(viewer: SessionUser, managerId: string) {
  if (viewer.role === "admin") return true;
  if (viewer.role !== "manager") return false;
  const [m] = await db.select({ userId: managers.userId }).from(managers).where(eq(managers.id, managerId)).limit(1);
  return m?.userId === viewer.id;
}

export async function managerIdForUser(userId: string) {
  const [m] = await db.select({ id: managers.id }).from(managers).where(eq(managers.userId, userId)).limit(1);
  return m?.id ?? null;
}

/* ───────────────────────────── Réalisations ───────────────────────────── */

/** Locations réalisées par un gestionnaire, ou par toute l'équipe quand userId est null (administrateur). */
export async function managerRentals(userId: string | null, opts: { carId?: string } = {}) {
  const res = await db.execute<{
    id: string;
    reference: string;
    status: "confirmed" | "ongoing" | "completed";
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
    LEFT JOIN users h ON h.id = r.handled_by
    JOIN cars c ON c.id = r.car_id
    JOIN agencies a ON a.id = r.pickup_agency_id
    LEFT JOIN promotions p ON p.id = r.promotion_id
    WHERE ${userId ? sql`r.handled_by = ${userId} AND` : sql``} ${opts.carId ? sql`r.car_id = ${opts.carId} AND` : sql``} r.status IN ('confirmed', 'ongoing', 'completed')
    ORDER BY r.start_date DESC
    LIMIT 1000
  `);
  return res.rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    status: r.status,
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
export type RentalRow = Awaited<ReturnType<typeof managerRentals>>[number];

/* ──────────────────────────────── Deals ──────────────────────────────── */

/** Deals d'un gestionnaire ou d'un client (fiche client : tous les gestionnaires). */
export async function listDeals(scope: { managerId?: string; clientId?: string; createdBy?: string }) {
  const rows = await db.query.deals.findMany({
    where: scope.clientId ? eq(deals.clientId, scope.clientId) : scope.createdBy ? eq(deals.createdBy, scope.createdBy) : eq(deals.managerId, scope.managerId!),
    orderBy: [desc(deals.updatedAt)],
    with: {
      manager: { columns: { id: true, firstName: true, lastName: true } },
      client: { columns: { id: true, name: true } },
      car: { columns: { id: true, brand: true, model: true, plateNumber: true } },
      promotion: { columns: { id: true, code: true, kind: true, value: true } },
      events: { orderBy: [desc(dealEvents.createdAt)], with: { actor: { columns: { name: true, email: true } } } },
      author: { columns: { name: true, email: true, role: true }, with: { manager: { columns: { firstName: true, lastName: true } } } },
    },
  });
  return rows.map((d) => ({
    id: d.id,
    type: d.type,
    managerId: d.managerId,
    managerName: d.manager ? `${d.manager.firstName} ${d.manager.lastName}` : null,
    clientId: d.clientId,
    clientName: d.client?.name ?? null,
    prospectName: d.prospectName,
    phone: d.phone,
    email: d.email,
    city: d.city,
    source: d.source,
    carId: d.carId,
    car: d.car ? `${d.car.brand} ${d.car.model}` : null,
    promotionId: d.promotionId,
    promotion: d.promotion,
    amount: d.amount,
    expectedDate: d.expectedDate,
    nextFollowUp: d.nextFollowUp,
    notes: d.notes,
    nextAction: d.nextAction,
    contactAt: d.contactAt.toISOString(),
    sentToClientAt: d.sentToClientAt?.toISOString() ?? null,
    /** Auteur du prospect : gestionnaire ou administrateur */
    authorName: d.author ? (d.author.manager ? `${d.author.manager.firstName} ${d.author.manager.lastName}` : (d.author.name ?? d.author.email)) : null,
    authorRole: d.author?.role === "admin" || d.author?.role === "manager" ? d.author.role : null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    events: d.events.map((e) => ({
      id: e.id,
      fromType: e.fromType,
      toType: e.toType,
      note: e.note,
      at: e.createdAt.toISOString(),
      actor: e.actor?.name ?? e.actor?.email ?? null,
    })),
  }));
}
export type DealRow = Awaited<ReturnType<typeof listDeals>>[number];
export const managerDeals = (managerId: string) => listDeals({ managerId });

/** Listes pour les menus du formulaire de deal. */
export async function dealFormOptions() {
  const [carRows, promoRows, scope] = await Promise.all([
    db
      .select({ id: cars.id, brand: cars.brand, model: cars.model, plate: cars.plateNumber, agencyId: cars.agencyId })
      .from(cars)
      .where(eq(cars.status, "active"))
      .orderBy(asc(cars.brand), asc(cars.model)),
    db
      .select({ id: promotions.id, code: promotions.code, kind: promotions.kind, value: promotions.value })
      .from(promotions)
      .where(and(eq(promotions.isActive, true)))
      .orderBy(asc(promotions.code)),
    currentAgencyScope(),
  ]);
  return {
    // Gestionnaire rattaché à des agences : seulement les voitures de son périmètre.
    cars: carRows.filter((c) => !scope || scope.includes(c.agencyId)).map((c) => ({ id: c.id, label: `${c.brand} ${c.model} (${c.plate})` })),
    promotions: promoRows,
  };
}

/* ────────────────────────────── Historique ────────────────────────────── */

export type ActivityGroup = "session" | "fleet" | "reservations" | "clients" | "deals" | "profile" | "agencies" | "exports";

/**
 * Journal d'un gestionnaire : connexions, actions sur le parc et les réservations (audit_logs),
 * suivi des deals (deal_events) et événements de sa fiche (manager_events).
 */
export function managerActivity(userId: string, managerId: string) {
  return activityLog({ userId, managerId });
}

/**
 * Historique : connexions, parc, réservations, clients, deals et fiche, avec l'auteur de chaque événement
 * (nom complet, gestionnaire ou administrateur). Sans périmètre (null) : toute l'équipe, pour l'administrateur.
 */
export async function activityLog(scope: { userId: string; managerId: string | null } | null) {
  const byActor = (col: ReturnType<typeof sql.raw>) => (scope ? sql`${col} = ${scope.userId}` : sql`TRUE`);
  const res = await db.execute<{
    id: string;
    at: string;
    source: "audit" | "deal" | "profile";
    entity: string | null;
    action: string;
    car: string | null;
    reference: string | null;
    deal_name: string | null;
    from_type: string | null;
    to_type: string | null;
    detail: string | null;
    provider: string | null;
    actor_name: string | null;
    actor_role: "admin" | "manager" | "client" | null;
  }>(sql`
    SELECT x.*,
           COALESCE(NULLIF(trim(xm.first_name || ' ' || xm.last_name), ''), xu.name, xu.email) AS actor_name,
           xu.role AS actor_role
    FROM (
      SELECT 'a' || l.id AS id, l.created_at AS at, 'audit' AS source, l.entity, l.action,
             CASE WHEN c.id IS NOT NULL THEN c.brand || ' ' || c.model || ' (' || c.plate_number || ')' END AS car,
             r.reference,
             COALESCE(NULLIF(trim(coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, '')), ''), cu.name, cu.email,
                      NULLIF(trim(coalesce(ap_cp.first_name, '') || ' ' || coalesce(ap_cp.last_name, '')), ''), au.name,
                      NULLIF(trim(lm.first_name || ' ' || lm.last_name), ''), ag.name, l.changes->>'title') AS deal_name,
             NULL AS from_type, NULL AS to_type,
             COALESCE(l.changes->>'reason', l.changes->>'note',
                      CASE WHEN l.entity = 'export' THEN upper(l.changes->>'format') || ' · ' || (l.changes->>'rows') END) AS detail,
             l.changes->>'provider' AS provider,
             l.actor_id
      FROM audit_logs l
      LEFT JOIN cars c ON l.entity = 'car' AND c.id::text = l.entity_id
      LEFT JOIN reservations r ON l.entity = 'reservation' AND r.id::text = l.entity_id
      LEFT JOIN users cu ON l.entity = 'client' AND cu.id::text = l.entity_id
      LEFT JOIN client_profiles cp ON cp.user_id = cu.id
      LEFT JOIN appointments ap ON l.entity = 'appointment' AND ap.id::text = l.entity_id
      LEFT JOIN users au ON au.id = ap.client_id
      LEFT JOIN client_profiles ap_cp ON ap_cp.user_id = au.id
      LEFT JOIN managers lm ON l.entity = 'manager' AND lm.id::text = l.entity_id
      LEFT JOIN agencies ag ON l.entity = 'agency' AND ag.id::text = l.entity_id
      WHERE (${byActor(sql.raw("l.actor_id"))}
             OR ${scope?.managerId ? sql`(l.entity = 'manager' AND l.entity_id = ${scope.managerId})` : sql`FALSE`})
        AND l.entity <> 'email_template'
      UNION ALL
      SELECT 'd' || e.id, e.created_at, 'deal', 'deal',
             CASE WHEN e.from_type IS NULL THEN 'create' WHEN e.from_type IS DISTINCT FROM e.to_type THEN 'update' ELSE 'note' END,
             NULL, NULL, d.prospect_name, e.from_type::text, e.to_type::text, e.note, NULL, e.actor_id
      FROM deal_events e JOIN deals d ON d.id = e.deal_id
      WHERE ${byActor(sql.raw("e.actor_id"))}
      UNION ALL
      SELECT 'p' || me.id, me.created_at, 'profile', 'profile', me.event::text,
             NULL, NULL, pm.first_name || ' ' || pm.last_name, NULL, NULL, me.reason, NULL, me.actor_id
      FROM manager_events me JOIN managers pm ON pm.id = me.manager_id
      WHERE ${scope ? (scope.managerId ? sql`me.manager_id = ${scope.managerId}` : sql`FALSE`) : sql`TRUE`}
    ) x
    LEFT JOIN users xu ON xu.id = x.actor_id
    LEFT JOIN managers xm ON xm.user_id = x.actor_id
    ORDER BY x.at DESC
    LIMIT ${scope ? 500 : 1000}
  `);
  return res.rows.map((r) => {
    const group: ActivityGroup =
      r.source === "deal"
        ? "deals"
        : r.source === "profile" || r.entity === "manager"
          ? "profile"
          : r.entity === "agency"
            ? "agencies"
            : r.entity === "export"
              ? "exports"
          : r.entity === "session" || r.entity === "security"
            ? "session"
            : r.entity === "car"
              ? "fleet"
              : r.entity === "client" || r.entity === "appointment" || r.entity === "marketing"
                ? "clients"
                : "reservations";
    const kind = r.source === "audit" ? `${r.entity}_${r.action}` : r.source === "deal" ? `deal_${r.action}` : `profile_${r.action}`;
    return {
      id: r.id,
      at: new Date(r.at).toISOString(),
      group,
      kind,
      car: r.car,
      reference: r.reference,
      dealName: r.deal_name,
      fromType: r.from_type,
      toType: r.to_type,
      detail: r.detail,
      provider: r.provider,
      actorName: r.actor_name,
      actorRole: r.actor_role === "client" ? null : r.actor_role,
    };
  });
}
export type ActivityRow = Awaited<ReturnType<typeof managerActivity>>[number];

export type AppointmentRow = Awaited<ReturnType<typeof myAppointments>>[number];

/**
 * "Mes rendez-vous" : départs et retours à venir (60 jours). Un gestionnaire voit les voitures qui lui sont
 * associées, celles sans gestionnaire associé (= tous) et les réservations qu'il a traitées ; l'administrateur voit tout.
 */
export async function myAppointments(viewer: { id: string; role: string }) {
  const managerId = viewer.role === "manager" ? await managerIdForUser(viewer.id) : null;
  const scope =
    viewer.role === "admin"
      ? sql`TRUE`
      : sql`(r.handled_by = ${viewer.id}
             OR NOT EXISTS (SELECT 1 FROM car_managers cm WHERE cm.car_id = r.car_id)
             OR EXISTS (SELECT 1 FROM car_managers cm WHERE cm.car_id = r.car_id AND cm.manager_id = ${managerId}))`;
  const res = await db.execute<{
    id: string;
    reference: string;
    status: "pending" | "confirmed" | "ongoing";
    kind: "pickup" | "return";
    at: string;
    car: string;
    plate: string;
    category: string;
    color_hex: string;
    driver: string;
    phone: string;
    agency: string;
    city: string;
    flight: string | null;
  }>(sql`
    WITH ev AS (
      SELECT r.*, 'pickup' AS kind, r.start_date AS at, r.pickup_agency_id AS agency_id FROM reservations r
        WHERE r.status IN ('pending', 'confirmed') AND r.start_date BETWEEN current_date AND current_date + 60
      UNION ALL
      SELECT r.*, 'return' AS kind, r.end_date AS at, r.return_agency_id AS agency_id FROM reservations r
        WHERE r.status IN ('confirmed', 'ongoing') AND r.end_date BETWEEN current_date AND current_date + 60
    )
    SELECT r.id, r.reference, r.status, r.kind, r.at::text, c.brand || ' ' || c.model AS car, c.plate_number AS plate,
           c.category, c.color_hex, r.driver_first_name || ' ' || r.driver_last_name AS driver, r.driver_phone AS phone,
           a.name AS agency, a.city, r.flight_number AS flight
    FROM ev r
    JOIN cars c ON c.id = r.car_id
    JOIN agencies a ON a.id = r.agency_id
    WHERE ${scope}
    ORDER BY r.at, r.kind DESC
    LIMIT 500
  `);
  return res.rows.map((r) => ({
    id: `${r.id}:${r.kind}`,
    reservationId: r.id,
    reference: r.reference,
    status: r.status,
    kind: r.kind,
    at: r.at,
    car: r.car,
    plate: r.plate,
    category: r.category,
    colorHex: r.color_hex,
    driver: r.driver,
    phone: r.phone,
    agency: `${r.city}, ${r.agency}`,
    flight: r.flight,
  }));
}

/** Rendez-vous planifiés (agence, appel, livraison, essai…) : les siens, ou tous pour l'administrateur. */
export async function scheduledAppointments(viewer: { id: string; role: string }) {
  const res = await db.execute<{
    id: string;
    kind: "meeting" | "call" | "delivery" | "test_drive" | "other";
    status: "planned" | "done" | "cancelled" | "no_show";
    starts_at: string;
    duration_min: number;
    notes: string | null;
    client_id: string;
    client: string | null;
    phone: string | null;
    agency: string | null;
    car: string | null;
    assignee: string | null;
  }>(sql`
    SELECT a.id, a.kind, a.status, a.starts_at, a.duration_min, a.notes, a.client_id,
           coalesce(p.first_name || ' ' || p.last_name, cu.name) AS client, cu.phone,
           CASE WHEN ag.id IS NOT NULL THEN ag.city || ', ' || ag.name END AS agency,
           CASE WHEN c.id IS NOT NULL THEN c.brand || ' ' || c.model END AS car,
           su.name AS assignee
    FROM appointments a
    JOIN users cu ON cu.id = a.client_id
    LEFT JOIN client_profiles p ON p.user_id = cu.id
    LEFT JOIN agencies ag ON ag.id = a.agency_id
    LEFT JOIN cars c ON c.id = a.car_id
    LEFT JOIN users su ON su.id = a.assigned_to
    WHERE a.starts_at >= now() - interval '30 days'
      ${viewer.role === "admin" ? sql`` : sql`AND a.assigned_to = ${viewer.id}`}
    ORDER BY a.starts_at
    LIMIT 500
  `);
  return res.rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    startsAt: new Date(r.starts_at).toISOString(),
    durationMin: r.duration_min,
    notes: r.notes,
    clientId: r.client_id,
    client: r.client ?? "—",
    phone: r.phone,
    agency: r.agency,
    car: r.car,
    assignee: r.assignee,
  }));
}
export type ScheduledRow = Awaited<ReturnType<typeof scheduledAppointments>>[number];

/** Membres de l'équipe à qui confier un rendez-vous (administrateur). */
export async function staffOptions() {
  const rows = await db.execute<{ id: string; name: string | null; role: string }>(sql`
    SELECT u.id, coalesce(m.first_name || ' ' || m.last_name, u.name, u.email) AS name, u.role
    FROM users u LEFT JOIN managers m ON m.user_id = u.id
    WHERE u.role IN ('admin', 'manager') AND u.status = 'active' AND (m.id IS NULL OR m.status = 'active')
    ORDER BY u.role, name
  `);
  return rows.rows.map((r) => ({ id: r.id, name: r.name ?? "—", role: r.role }));
}

/* ───────────────────────────── En-tête de fiche ───────────────────────────── */

/** En ligne = activité dans les 5 dernières minutes (users.last_seen_at, mis à jour à chaque page). */
export const ONLINE_WINDOW_MS = 5 * 60_000;

/**
 * Résumé affiché en haut de la fiche d'un gestionnaire ou de l'administrateur : présence,
 * dernière connexion, voitures affectées et leurs villes, règle marque / ville, dernier deal conclu.
 */
export async function staffSummary(userId: string, managerId: string | null) {
  const res = await db.execute<{
    last_seen_at: string | null;
    last_login_at: string | null;
    car_count: number;
    fleet_count: number;
    cities: string[] | null;
    rule_brands: string[] | null;
    rule_cities: string[] | null;
    rule_agencies: number[] | null;
    rule_count: number | null;
    rule_car_ids: string[] | null;
    deal_name: string | null;
    deal_at: string | null;
  }>(sql`
    SELECT u.last_seen_at, u.last_login_at,
      (SELECT count(*)::int FROM car_managers cm WHERE cm.manager_id = ${managerId}) AS car_count,
      (SELECT count(*)::int FROM cars c WHERE c.status <> 'deactivated') AS fleet_count,
      (SELECT array_agg(DISTINCT a.city ORDER BY a.city) FROM car_managers cm
         JOIN cars c ON c.id = cm.car_id JOIN agencies a ON a.id = c.agency_id WHERE cm.manager_id = ${managerId}) AS cities,
      r.brands AS rule_brands, r.cities AS rule_cities, r.agencies AS rule_agencies, r.car_count AS rule_count,
      (SELECT array_agg(cm.car_id::text) FROM car_managers cm WHERE cm.manager_id = ${managerId} AND cm.source = 'rule') AS rule_car_ids,
      d.prospect_name AS deal_name, d.updated_at AS deal_at
    FROM users u
    LEFT JOIN manager_car_rules r ON r.manager_id = ${managerId}
    LEFT JOIN LATERAL (
      SELECT dd.prospect_name, dd.updated_at FROM deals dd
      WHERE dd.type = 'rental' AND (dd.created_by = u.id OR (${managerId}::uuid IS NOT NULL AND dd.manager_id = ${managerId}))
      ORDER BY dd.updated_at DESC LIMIT 1
    ) d ON TRUE
    WHERE u.id = ${userId}
  `);
  const r = res.rows[0];
  const lastSeen = r?.last_seen_at ? new Date(r.last_seen_at) : null;
  const ruleCities = r?.rule_cities ?? [];
  return {
    online: Boolean(lastSeen && Date.now() - lastSeen.getTime() < ONLINE_WINDOW_MS),
    lastLoginAt: r?.last_login_at ? new Date(r.last_login_at).toISOString() : null,
    carCount: r?.car_count ?? 0,
    fleetCount: r?.fleet_count ?? 0,
    /** Villes de la règle, sinon villes des agences des voitures affectées */
    cities: ruleCities.length ? ruleCities : (r?.cities ?? []),
    rule:
      r && (r.rule_brands?.length || ruleCities.length || r.rule_agencies?.length)
        ? { brands: r.rule_brands ?? [], cities: ruleCities, agencies: r.rule_agencies ?? [], carCount: r.rule_count ?? 0 }
        : null,
    ruleCarIds: r?.rule_car_ids ?? [],
    lastDeal: r?.deal_name ? { name: r.deal_name, at: new Date(r.deal_at!).toISOString() } : null,
  };
}
export type StaffSummary = Awaited<ReturnType<typeof staffSummary>>;
