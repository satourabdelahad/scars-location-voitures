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
      status: cars.status,
      deactivationReason: cars.deactivationReason,
      city: agencies.city,
      agencyName: agencies.name,
      cover: sql<string | null>`(SELECT ci.url FROM ${carImages} ci WHERE ci.car_id = ${cars.id} ORDER BY ci.position LIMIT 1)`,
      reservationsCount: sql<number>`(SELECT count(*)::int FROM reservations r WHERE r.car_id = ${cars.id} AND r.status IN ('confirmed','ongoing','completed'))`,
      onRoad: sql<boolean>`EXISTS (SELECT 1 FROM reservations r WHERE r.car_id = ${cars.id} AND r.status = 'ongoing')`,
      nextBooking: sql<string | null>`(SELECT min(r.start_date)::text FROM reservations r WHERE r.car_id = ${cars.id} AND r.status IN ('pending','confirmed') AND r.start_date >= CURRENT_DATE)`,
    })
    .from(cars)
    .innerJoin(agencies, eq(agencies.id, cars.agencyId))
    .orderBy(asc(cars.status), asc(cars.brand), asc(cars.model));
}
export type FleetRow = Awaited<ReturnType<typeof listFleet>>[number];

export async function getFleetCar(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const car = await db.query.cars.findFirst({
    where: eq(cars.id, id),
    with: {
      agency: true,
      images: { orderBy: [asc(carImages.position)] },
      translations: { orderBy: [asc(carTranslations.locale)] },
    },
  });
  if (!car) return null;
  const by = car.deactivatedBy
    ? (await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, car.deactivatedBy)).limit(1))[0]
    : null;
  return { ...car, deactivatedByName: by?.name ?? by?.email ?? null };
}
export type FleetCar = NonNullable<Awaited<ReturnType<typeof getFleetCar>>>;

export async function allAgencies() {
  return db.select({ id: agencies.id, city: agencies.city, name: agencies.name }).from(agencies).orderBy(asc(agencies.city), desc(agencies.isAirport));
}
