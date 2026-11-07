import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { agencies, cars, reservations, users } from "@/db/schema";

const handler = alias(users, "handler");

/** Réservations pour l'équipe : les 12 derniers mois et tout ce qui est à venir. */
/** Réservations visibles par l'équipe ; pour une voiture donnée, tout l'historique. */
export async function listReservationsForStaff(opts: { carId?: string } = {}) {
  return db
    .select({
      id: reservations.id,
      reference: reservations.reference,
      status: reservations.status,
      startDate: reservations.startDate,
      endDate: reservations.endDate,
      days: reservations.days,
      totalPrice: reservations.totalPrice,
      createdAt: reservations.createdAt,
      clientName: users.name,
      clientEmail: users.email,
      driver: sql<string>`${reservations.driverFirstName} || ' ' || ${reservations.driverLastName}`,
      driverPhone: reservations.driverPhone,
      car: sql<string>`${cars.brand} || ' ' || ${cars.model}`,
      plate: cars.plateNumber,
      pickup: agencies.city,
      handledBy: handler.name,
      /** Utilisateurs responsables de l'agence de départ : ils valident la réservation (avec l'administrateur) */
      responsibleUserIds: sql<string[]>`coalesce((SELECT array_agg(m.user_id) FROM managers m WHERE m.id IN (
        SELECT ma.manager_id FROM manager_agencies ma WHERE ma.agency_id = ${agencies.id} AND ma.is_responsible
        UNION SELECT cr.manager_id FROM car_responsibles cr WHERE cr.car_id = ${cars.id})), '{}')`,
    })
    .from(reservations)
    .innerJoin(users, eq(users.id, reservations.clientId))
    .innerJoin(cars, eq(cars.id, reservations.carId))
    .innerJoin(agencies, eq(agencies.id, reservations.pickupAgencyId))
    .leftJoin(handler, eq(handler.id, reservations.handledBy))
    .where(opts.carId ? eq(reservations.carId, opts.carId) : gte(reservations.endDate, sql`CURRENT_DATE - interval '12 months'`))
    .orderBy(sql`CASE ${reservations.status} WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'ongoing' THEN 2 ELSE 3 END`, desc(reservations.startDate));
}
export type StaffReservationRow = Awaited<ReturnType<typeof listReservationsForStaff>>[number];

export async function getReservationForStaff(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return db.query.reservations.findFirst({
    where: eq(reservations.id, id),
    with: {
      car: true,
      client: { columns: { name: true, email: true, phone: true } },
      handler: { columns: { name: true, email: true } },
      pickupAgency: true,
      returnAgency: true,
      extras: { with: { extra: true } },
      promotion: true,
    },
  });
}

/** Indicateurs du tableau de bord (heure du Maroc). */
export async function dashboardStats() {
  const [row] = (
    await db.execute<{ active_cars: number; on_road: number; pending: number; revenue: number; active_managers: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM cars WHERE status = 'active') AS active_cars,
        (SELECT count(*)::int FROM reservations WHERE status = 'ongoing') AS on_road,
        (SELECT count(*)::int FROM reservations WHERE status = 'pending') AS pending,
        (SELECT coalesce(sum(total_price), 0)::float FROM reservations
           WHERE status IN ('confirmed','ongoing','completed')
             AND start_date >= date_trunc('month', now() AT TIME ZONE 'Africa/Casablanca')::date) AS revenue,
        (SELECT count(*)::int FROM managers WHERE status = 'active') AS active_managers
    `)
  ).rows;
  return row;
}

export async function todayMovements() {
  const today = sql`(now() AT TIME ZONE 'Africa/Casablanca')::date`;
  const base = db
    .select({
      id: reservations.id,
      reference: reservations.reference,
      status: reservations.status,
      car: sql<string>`${cars.brand} || ' ' || ${cars.model}`,
      plate: cars.plateNumber,
      driver: sql<string>`${reservations.driverFirstName} || ' ' || ${reservations.driverLastName}`,
      city: agencies.city,
    })
    .from(reservations)
    .innerJoin(cars, eq(cars.id, reservations.carId))
    .innerJoin(agencies, eq(agencies.id, reservations.pickupAgencyId));
  const [departures, returns, pending] = await Promise.all([
    base.where(and(eq(reservations.startDate, today), inArray(reservations.status, ["confirmed", "ongoing"]))),
    db
      .select({
        id: reservations.id,
        reference: reservations.reference,
        status: reservations.status,
        car: sql<string>`${cars.brand} || ' ' || ${cars.model}`,
        plate: cars.plateNumber,
        driver: sql<string>`${reservations.driverFirstName} || ' ' || ${reservations.driverLastName}`,
        city: agencies.city,
      })
      .from(reservations)
      .innerJoin(cars, eq(cars.id, reservations.carId))
      .innerJoin(agencies, eq(agencies.id, reservations.returnAgencyId))
      .where(and(eq(reservations.endDate, today), inArray(reservations.status, ["ongoing", "completed"]))),
    db
      .select({
        id: reservations.id,
        reference: reservations.reference,
        startDate: reservations.startDate,
        endDate: reservations.endDate,
        totalPrice: reservations.totalPrice,
        car: sql<string>`${cars.brand} || ' ' || ${cars.model}`,
        driver: sql<string>`${reservations.driverFirstName} || ' ' || ${reservations.driverLastName}`,
        createdAt: reservations.createdAt,
      })
      .from(reservations)
      .innerJoin(cars, eq(cars.id, reservations.carId))
      .where(eq(reservations.status, "pending"))
      .orderBy(reservations.startDate)
      .limit(6),
  ]);
  return { departures, returns, pending };
}


/** L'administrateur, les responsables de l'agence de départ et ceux de la voiture valident (confirment ou refusent) une réservation. */
export async function canValidateReservation(user: { id: string; role: string }, reservationId: string) {
  if (user.role === "admin") return true;
  const res = await db.execute<{ ok: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM reservations r
      JOIN manager_agencies ma ON ma.agency_id = r.pickup_agency_id AND ma.is_responsible
      JOIN managers m ON m.id = ma.manager_id
      WHERE r.id = ${reservationId} AND m.user_id = ${user.id}
    ) OR EXISTS (
      SELECT 1 FROM reservations r
      JOIN car_responsibles cr ON cr.car_id = r.car_id
      JOIN managers m ON m.id = cr.manager_id
      WHERE r.id = ${reservationId} AND m.user_id = ${user.id}
    ) AS ok`);
  return Boolean(res.rows[0]?.ok);
}
