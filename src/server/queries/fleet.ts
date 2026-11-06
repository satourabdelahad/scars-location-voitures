import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agencies, carImages, carTranslations, cars, users } from "@/db/schema";

/** Parc complet pour l'équipe (y compris les voitures désactivées). */
export async function listFleet() {
  return db
    .select({
      id: cars.id,
      brand: cars.brand,
      model: cars.model,
      year: cars.year,
      category: cars.category,
      transmission: cars.transmission,
      fuel: cars.fuel,
      seats: cars.seats,
      colorName: cars.colorName,
      colorHex: cars.colorHex,
      plateNumber: cars.plateNumber,
      mileage: cars.mileage,
      dailyPrice: cars.dailyPrice,
      promoPercent: cars.promoPercent,
      promoStartsOn: cars.promoStartsOn,
      promoEndsOn: cars.promoEndsOn,
      purchaseCity: cars.purchaseCity,
      purchaseDate: cars.purchaseDate,
      purchasePrice: cars.purchasePrice,
      status: cars.status,
      deactivationReason: cars.deactivationReason,
      city: agencies.city,
      agencyName: agencies.name,
      agencyId: cars.agencyId,
      cover: sql<string | null>`(SELECT ci.url FROM ${carImages} ci WHERE ci.car_id = ${cars.id} ORDER BY ci.position LIMIT 1)`,
      reservationsCount: sql<number>`(SELECT count(*)::int FROM reservations r WHERE r.car_id = ${cars.id} AND r.status IN ('confirmed','ongoing','completed'))`,
      onRoad: sql<boolean>`EXISTS (SELECT 1 FROM reservations r WHERE r.car_id = ${cars.id}
        AND (r.status = 'ongoing' OR (r.status = 'confirmed' AND CURRENT_DATE >= r.start_date AND CURRENT_DATE < r.end_date)))`,
      nextBooking: sql<string | null>`(SELECT min(r.start_date)::text FROM reservations r WHERE r.car_id = ${cars.id} AND r.status IN ('pending','confirmed') AND r.start_date >= CURRENT_DATE)`,
      /** Gestionnaires associés (vide = tous les gestionnaires) */
      managerNames: sql<string[]>`COALESCE((SELECT array_agg(m.first_name || ' ' || m.last_name ORDER BY m.last_name) FROM car_managers cm JOIN managers m ON m.id = cm.manager_id WHERE cm.car_id = ${cars.id}), '{}')`,
      managerIds: sql<string[]>`COALESCE((SELECT array_agg(cm.manager_id::text) FROM car_managers cm WHERE cm.car_id = ${cars.id}), '{}')`,
      createdBy: cars.createdBy,
      createdAt: cars.createdAt,
    })
    .from(cars)
    .innerJoin(agencies, eq(agencies.id, cars.agencyId))
    .orderBy(asc(cars.status), asc(cars.brand), asc(cars.model));
}
export type FleetRow = Awaited<ReturnType<typeof listFleet>>[number];

export { carState, type CarState } from "@/lib/car-state";

export async function getFleetCar(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const car = await db.query.cars.findFirst({
    where: eq(cars.id, id),
    with: {
      agency: true,
      images: { orderBy: [asc(carImages.position)] },
      translations: { orderBy: [asc(carTranslations.locale)] },
      managers: { with: { manager: { columns: { id: true, firstName: true, lastName: true } } } },
    },
  });
  if (!car) return null;
  const by = car.deactivatedBy
    ? (await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, car.deactivatedBy)).limit(1))[0]
    : null;
  return { ...car, deactivatedByName: by?.name ?? by?.email ?? null };
}
export type FleetCar = NonNullable<Awaited<ReturnType<typeof getFleetCar>>>;

/** Agences actives (formulaires : voiture, rendez-vous). */
export async function allAgencies() {
  return db
    .select({ id: agencies.id, city: agencies.city, name: agencies.name })
    .from(agencies)
    .where(eq(agencies.isActive, true))
    .orderBy(asc(agencies.city), desc(agencies.isAirport));
}

/** Gestionnaires actifs, pour l'association aux voitures. */
export async function managerOptions() {
  const rows = await db.query.managers.findMany({
    where: (m, { eq: q }) => q(m.status, "active"),
    columns: { id: true, firstName: true, lastName: true, city: true },
    orderBy: (m, { asc: a }) => [a(m.lastName), a(m.firstName)],
  });
  return rows.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, city: m.city }));
}

/** Résumé en haut de la fiche voiture : dernière location, gain cumulé, statistiques. */
export async function carSummary(carId: string) {
  const res = await db.execute<{
    rentals: number;
    days: number;
    revenue: string;
    last_start: string | null;
    last_at: string | null;
    last_client: string | null;
    last_reference: string | null;
    next_start: string | null;
    days_365: number;
  }>(sql`
    SELECT
      count(*)::int AS rentals,
      coalesce(sum(r.days), 0)::int AS days,
      coalesce(sum(r.total_price), 0) AS revenue,
      (SELECT x.start_date::text FROM reservations x WHERE x.car_id = ${carId} AND x.status IN ('confirmed','ongoing','completed') ORDER BY x.start_date DESC LIMIT 1) AS last_start,
      (SELECT coalesce(x.picked_up_at, x.confirmed_at) FROM reservations x WHERE x.car_id = ${carId} AND x.status IN ('confirmed','ongoing','completed') ORDER BY x.start_date DESC LIMIT 1) AS last_at,
      (SELECT x.driver_first_name || ' ' || x.driver_last_name FROM reservations x WHERE x.car_id = ${carId} AND x.status IN ('confirmed','ongoing','completed') ORDER BY x.start_date DESC LIMIT 1) AS last_client,
      (SELECT x.reference FROM reservations x WHERE x.car_id = ${carId} AND x.status IN ('confirmed','ongoing','completed') ORDER BY x.start_date DESC LIMIT 1) AS last_reference,
      (SELECT min(x.start_date)::text FROM reservations x WHERE x.car_id = ${carId} AND x.status IN ('pending','confirmed') AND x.start_date >= CURRENT_DATE) AS next_start,
      coalesce(sum(GREATEST(0, LEAST(r.end_date, CURRENT_DATE) - GREATEST(r.start_date, CURRENT_DATE - 365))), 0)::int AS days_365
    FROM reservations r
    WHERE r.car_id = ${carId} AND r.status IN ('confirmed', 'ongoing', 'completed')
  `);
  const r = res.rows[0];
  const rentals = r?.rentals ?? 0;
  const revenue = Number(r?.revenue ?? 0);
  return {
    rentals,
    days: r?.days ?? 0,
    revenue,
    averageRental: rentals ? revenue / rentals : 0,
    /** Taux d'occupation sur les 365 derniers jours */
    occupancy: Math.min(100, Math.round(((r?.days_365 ?? 0) / 365) * 100)),
    nextStart: r?.next_start ?? null,
    last: r?.last_start
      ? { start: r.last_start, at: r.last_at ? new Date(r.last_at).toISOString() : null, client: r.last_client ?? "—", reference: r.last_reference }
      : null,
  };
}
export type CarSummary = Awaited<ReturnType<typeof carSummary>>;
