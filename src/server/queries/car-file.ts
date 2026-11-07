import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { CarRecordKind, ExpenseCategory } from "@/db/schema";
import { pgArray } from "@/lib/utils";

export type CarRecordRow = {
  id: string;
  kind: CarRecordKind;
  category: ExpenseCategory | null;
  performedOn: string;
  validUntil: string | null;
  mileage: number | null;
  nextMileage: number | null;
  amount: number | null;
  provider: string | null;
  reference: string | null;
  notes: string | null;
  voided: boolean;
  createdBy: string | null;
  createdAt: string;
  files: { id: number; name: string; format: string | null }[];
};

/** Dossier d'une voiture, du plus récent au plus ancien. */
export async function carRecordsFor(carId: string): Promise<CarRecordRow[]> {
  const res = await db.execute<Record<string, unknown>>(sql`
    SELECT r.id, r.kind, r.category, r.performed_on, r.valid_until, r.mileage, r.next_mileage, r.amount::float AS amount,
           r.provider, r.reference, r.notes, (r.voided_at IS NOT NULL) AS voided, r.created_at,
           u.name AS created_by,
           COALESCE((SELECT json_agg(json_build_object('id', f.id, 'name', f.name, 'format', f.format) ORDER BY f.id)
                     FROM car_record_files f WHERE f.record_id = r.id), '[]') AS files
    FROM car_records r LEFT JOIN users u ON u.id = r.created_by
    WHERE r.car_id = ${carId}
    ORDER BY r.performed_on DESC, r.created_at DESC`);
  return res.rows.map((r) => ({
    id: r.id as string,
    kind: r.kind as CarRecordKind,
    category: (r.category as ExpenseCategory) ?? null,
    performedOn: String(r.performed_on),
    validUntil: (r.valid_until as string) ?? null,
    mileage: (r.mileage as number) ?? null,
    nextMileage: (r.next_mileage as number) ?? null,
    amount: r.amount == null ? null : Number(r.amount),
    provider: (r.provider as string) ?? null,
    reference: (r.reference as string) ?? null,
    notes: (r.notes as string) ?? null,
    voided: Boolean(r.voided),
    createdBy: (r.created_by as string) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
    files: r.files as CarRecordRow["files"],
  }));
}

export type InspectionRow = {
  id: string;
  kind: "departure" | "return";
  reservationId: string | null;
  reference: string | null;
  mileage: number;
  fuelEighths: number;
  damages: string | null;
  notes: string | null;
  signedByName: string | null;
  signed: boolean;
  photos: number;
  createdBy: string | null;
  createdAt: string;
};

export async function carInspectionsFor(carId: string): Promise<InspectionRow[]> {
  const res = await db.execute<Record<string, unknown>>(sql`
    SELECT i.id, i.kind, i.reservation_id, r.reference, i.mileage, i.fuel_eighths, i.damages, i.notes, i.signed_by_name,
           (i.signature_public_id IS NOT NULL) AS signed, i.created_at, u.name AS created_by,
           (SELECT count(*)::int FROM car_inspection_photos p WHERE p.inspection_id = i.id) AS photos
    FROM car_inspections i
    LEFT JOIN reservations r ON r.id = i.reservation_id
    LEFT JOIN users u ON u.id = i.created_by
    WHERE i.car_id = ${carId}
    ORDER BY i.created_at DESC`);
  return res.rows.map((r) => ({
    id: r.id as string,
    kind: r.kind as InspectionRow["kind"],
    reservationId: (r.reservation_id as string) ?? null,
    reference: (r.reference as string) ?? null,
    mileage: Number(r.mileage),
    fuelEighths: Number(r.fuel_eighths),
    damages: (r.damages as string) ?? null,
    notes: (r.notes as string) ?? null,
    signedByName: (r.signed_by_name as string) ?? null,
    signed: Boolean(r.signed),
    photos: Number(r.photos),
    createdBy: (r.created_by as string) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

/** Réservations de la voiture qu'on peut rattacher à un état des lieux (confirmées ou en cours, ou terminées récemment). */
export async function inspectableReservations(carId: string) {
  const res = await db.execute<{ id: string; reference: string; status: string; start_date: string; end_date: string; name: string }>(sql`
    SELECT r.id, r.reference, r.status, r.start_date, r.end_date, r.driver_first_name || ' ' || r.driver_last_name AS name
    FROM reservations r
    WHERE r.car_id = ${carId} AND (r.status IN ('confirmed', 'ongoing') OR (r.status = 'completed' AND r.end_date >= current_date - 30))
    ORDER BY r.start_date DESC LIMIT 20`);
  return res.rows.map((r) => ({ id: r.id, reference: r.reference, status: r.status, startDate: String(r.start_date), endDate: String(r.end_date), name: r.name }));
}

export type FinanceMonth = { month: string; revenue: number; expenses: number };
export type CarFinance = {
  revenue: number;
  expenses: number;
  margin: number;
  purchasePrice: number | null;
  /** Ce qu'il reste à amortir : prix d'achat − marge (négatif = la voiture est remboursée) */
  toRecover: number | null;
  rentals: number;
  rentedDays: number;
  byKind: { kind: CarRecordKind; category: ExpenseCategory | null; amount: number }[];
  months: FinanceMonth[];
};

/**
 * Rentabilité d'une voiture : chiffre d'affaires des locations confirmées, en cours ou terminées,
 * moins toutes les dépenses du dossier (assurance, vignette, vidange, visite, entretien…).
 */
export async function carFinance(carId: string): Promise<CarFinance> {
  const [tot, kinds, months, car] = await Promise.all([
    db.execute<{ revenue: number; rentals: number; days: number; expenses: number }>(sql`
      SELECT COALESCE((SELECT sum(total_price) FROM reservations WHERE car_id = ${carId} AND status IN ('confirmed','ongoing','completed')), 0)::float AS revenue,
             (SELECT count(*) FROM reservations WHERE car_id = ${carId} AND status IN ('confirmed','ongoing','completed'))::int AS rentals,
             COALESCE((SELECT sum(days) FROM reservations WHERE car_id = ${carId} AND status IN ('confirmed','ongoing','completed')), 0)::int AS days,
             COALESCE((SELECT sum(amount) FROM car_records WHERE car_id = ${carId} AND voided_at IS NULL), 0)::float AS expenses`),
    db.execute<{ kind: CarRecordKind; category: ExpenseCategory | null; amount: number }>(sql`
      SELECT kind, category, sum(amount)::float AS amount FROM car_records
      WHERE car_id = ${carId} AND voided_at IS NULL AND amount IS NOT NULL
      GROUP BY kind, category ORDER BY 3 DESC`),
    db.execute<{ month: string; revenue: number; expenses: number }>(sql`
      WITH m AS (SELECT to_char(d, 'YYYY-MM') AS month FROM generate_series(date_trunc('month', current_date) - interval '11 months', date_trunc('month', current_date), interval '1 month') d)
      SELECT m.month,
             COALESCE((SELECT sum(total_price) FROM reservations r WHERE r.car_id = ${carId} AND r.status IN ('confirmed','ongoing','completed') AND to_char(r.start_date, 'YYYY-MM') = m.month), 0)::float AS revenue,
             COALESCE((SELECT sum(amount) FROM car_records c WHERE c.car_id = ${carId} AND c.voided_at IS NULL AND to_char(c.performed_on, 'YYYY-MM') = m.month), 0)::float AS expenses
      FROM m ORDER BY m.month`),
    db.execute<{ purchase_price: number | null }>(sql`SELECT purchase_price::float AS purchase_price FROM cars WHERE id = ${carId}`),
  ]);
  const t = tot.rows[0];
  const revenue = Number(t?.revenue ?? 0);
  const expenses = Number(t?.expenses ?? 0);
  const purchasePrice = car.rows[0]?.purchase_price == null ? null : Number(car.rows[0].purchase_price);
  const margin = revenue - expenses;
  return {
    revenue,
    expenses,
    margin,
    purchasePrice,
    toRecover: purchasePrice == null ? null : purchasePrice - margin,
    rentals: Number(t?.rentals ?? 0),
    rentedDays: Number(t?.days ?? 0),
    byKind: kinds.rows.map((k) => ({ kind: k.kind, category: k.category, amount: Number(k.amount) })),
    months: months.rows.map((m) => ({ month: m.month, revenue: Number(m.revenue), expenses: Number(m.expenses) })),
  };
}

export type CalendarBooking = {
  id: string;
  carId: string;
  reference: string;
  status: string;
  startDate: string;
  endDate: string;
  client: string;
};

/** Réservations (hors annulées et refusées) qui touchent la période, pour le planning. */
export async function calendarBookings(from: string, to: string, carIds?: string[]): Promise<CalendarBooking[]> {
  const res = await db.execute<Record<string, string>>(sql`
    SELECT r.id, r.car_id, r.reference, r.status, r.start_date, r.end_date, r.driver_first_name || ' ' || r.driver_last_name AS client
    FROM reservations r
    WHERE r.status IN ('pending','confirmed','ongoing','completed')
      AND r.start_date <= ${to} AND r.end_date >= ${from}
      ${carIds ? sql`AND r.car_id = ANY(${pgArray(carIds)}::uuid[])` : sql``}
    ORDER BY r.start_date`);
  return res.rows.map((r) => ({ id: r.id, carId: r.car_id, reference: r.reference, status: r.status, startDate: String(r.start_date), endDate: String(r.end_date), client: r.client }));
}

export type Deadline = { kind: CarRecordKind; validUntil: string | null; nextMileage: number | null };

/** Dernière échéance connue de chaque type (assurance, vignette, vidange, visite technique) par voiture. */
export async function carDeadlines(carIds?: string[]) {
  const res = await db.execute<{ car_id: string; kind: CarRecordKind; valid_until: string | null; next_mileage: number | null }>(sql`
    SELECT DISTINCT ON (car_id, kind) car_id, kind, valid_until, next_mileage
    FROM car_records
    WHERE voided_at IS NULL AND kind <> 'expense' ${carIds ? sql`AND car_id = ANY(${pgArray(carIds)}::uuid[])` : sql``}
    ORDER BY car_id, kind, performed_on DESC, created_at DESC`);
  const map = new Map<string, Deadline[]>();
  for (const r of res.rows) {
    const list = map.get(r.car_id) ?? [];
    list.push({ kind: r.kind, validUntil: r.valid_until ? String(r.valid_until) : null, nextMileage: r.next_mileage });
    map.set(r.car_id, list);
  }
  return map;
}
