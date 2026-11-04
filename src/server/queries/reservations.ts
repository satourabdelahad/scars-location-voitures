import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { agencies, cars, reservations, users } from "@/db/schema";

const handler = alias(users, "handler");

/** Réservations pour l'équipe : les 12 derniers mois et tout ce qui est à venir. */
export async function listReservationsForStaff() {
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
    })
    .from(reservations)
    .innerJoin(users, eq(users.id, reservations.clientId))
    .innerJoin(cars, eq(cars.id, reservations.carId))
    .innerJoin(agencies, eq(agencies.id, reservations.pickupAgencyId))
    .leftJoin(handler, eq(handler.id, reservations.handledBy))
    .where(gte(reservations.endDate, sql`CURRENT_DATE - interval '12 months'`))
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

