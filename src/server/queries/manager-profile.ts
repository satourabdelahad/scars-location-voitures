import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
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

export async function managerRentals(userId: string) {
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
  }>(sql`
    SELECT r.id, r.reference, r.status, r.start_date::text, r.end_date::text, r.days,
           r.daily_price, r.extras_total, r.discount_amount, r.total_price, r.confirmed_at,
           c.brand, c.model, c.year, c.category, c.color_hex, c.plate_number,
           p.code AS promo_code, p.kind AS promo_kind, p.value AS promo_value,
           r.driver_first_name || ' ' || r.driver_last_name AS client, a.city
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    JOIN agencies a ON a.id = r.pickup_agency_id
    LEFT JOIN promotions p ON p.id = r.promotion_id
    WHERE r.handled_by = ${userId} AND r.status IN ('confirmed', 'ongoing', 'completed')
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
  }));
}
export type RentalRow = Awaited<ReturnType<typeof managerRentals>>[number];

/* ──────────────────────────────── Deals ──────────────────────────────── */

export async function managerDeals(managerId: string) {
  const rows = await db.query.deals.findMany({
    where: eq(deals.managerId, managerId),
    orderBy: [desc(deals.updatedAt)],
    with: {
      car: { columns: { id: true, brand: true, model: true, plateNumber: true } },
      promotion: { columns: { id: true, code: true, kind: true, value: true } },
      events: { orderBy: [desc(dealEvents.createdAt)], with: { actor: { columns: { name: true, email: true } } } },
    },
  });
  return rows.map((d) => ({
    id: d.id,
    type: d.type,
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
export type DealRow = Awaited<ReturnType<typeof managerDeals>>[number];

/** Listes pour les menus du formulaire de deal. */
export async function dealFormOptions() {
  const [carRows, promoRows] = await Promise.all([
    db
      .select({ id: cars.id, brand: cars.brand, model: cars.model, plate: cars.plateNumber })
      .from(cars)
      .where(eq(cars.status, "active"))
      .orderBy(asc(cars.brand), asc(cars.model)),
    db
      .select({ id: promotions.id, code: promotions.code, kind: promotions.kind, value: promotions.value })
      .from(promotions)
      .where(and(eq(promotions.isActive, true)))
      .orderBy(asc(promotions.code)),
  ]);
  return {
    cars: carRows.map((c) => ({ id: c.id, label: `${c.brand} ${c.model} (${c.plate})` })),
    promotions: promoRows,
  };
}

/* ────────────────────────────── Historique ────────────────────────────── */

export type ActivityGroup = "session" | "fleet" | "reservations" | "deals" | "profile";

/**
 * Journal d'un gestionnaire : connexions, actions sur le parc et les réservations (audit_logs),
 * suivi des deals (deal_events) et événements de sa fiche (manager_events).
 */
export async function managerActivity(userId: string, managerId: string) {
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
  }>(sql`
    SELECT * FROM (
      SELECT 'a' || l.id AS id, l.created_at AS at, 'audit' AS source, l.entity, l.action,
             CASE WHEN c.id IS NOT NULL THEN c.brand || ' ' || c.model || ' (' || c.plate_number || ')' END AS car,
             r.reference, NULL AS deal_name, NULL AS from_type, NULL AS to_type,
             COALESCE(l.changes->>'reason', l.changes->>'note') AS detail,
             l.changes->>'provider' AS provider
      FROM audit_logs l
      LEFT JOIN cars c ON l.entity = 'car' AND c.id::text = l.entity_id
      LEFT JOIN reservations r ON l.entity = 'reservation' AND r.id::text = l.entity_id
      WHERE l.actor_id = ${userId}
      UNION ALL
      SELECT 'd' || e.id, e.created_at, 'deal', 'deal',
             CASE WHEN e.from_type IS NULL THEN 'create' WHEN e.from_type IS DISTINCT FROM e.to_type THEN 'update' ELSE 'note' END,
             NULL, NULL, d.prospect_name, e.from_type::text, e.to_type::text, e.note, NULL
      FROM deal_events e JOIN deals d ON d.id = e.deal_id
      WHERE e.actor_id = ${userId}
      UNION ALL
      SELECT 'p' || me.id, me.created_at, 'profile', 'profile', me.event::text,
             NULL, NULL, NULL, NULL, NULL, me.reason, NULL
      FROM manager_events me
      WHERE me.manager_id = ${managerId}
    ) x
    ORDER BY at DESC
    LIMIT 500
  `);
  return res.rows.map((r) => {
    const group: ActivityGroup =
      r.source === "deal" ? "deals" : r.source === "profile" ? "profile" : r.entity === "session" ? "session" : r.entity === "car" ? "fleet" : "reservations";
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
    };
  });
}
export type ActivityRow = Awaited<ReturnType<typeof managerActivity>>[number];
