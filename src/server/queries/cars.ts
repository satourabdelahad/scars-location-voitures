import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { agencies, carImages, carTranslations, cars, reservations, type CarCategory } from "@/db/schema";

export type PublicCarFilters = {
  city?: string;
  start?: string;
  end?: string;
  category?: CarCategory;
  transmission?: "manual" | "automatic";
  fuel?: "petrol" | "diesel" | "hybrid" | "electric";
  seats?: number;
  maxPrice?: number;
  sort?: "price_asc" | "price_desc" | "newest";
  limit?: number;
};

const ACTIVE_RES = sql`('pending','confirmed','ongoing')`;

/** Voitures proposées au public : jamais les voitures désactivées. */
export async function listPublicCars(f: PublicCarFilters) {
  const where: SQL[] = [eq(cars.status, "active")];
  if (f.city) where.push(eq(agencies.slug, f.city));
  if (f.category) where.push(eq(cars.category, f.category));
  if (f.transmission) where.push(eq(cars.transmission, f.transmission));
  if (f.fuel) where.push(eq(cars.fuel, f.fuel));
  if (f.seats) where.push(gte(cars.seats, f.seats));
  if (f.maxPrice) where.push(lte(cars.dailyPrice, f.maxPrice));
  if (f.start && f.end && f.end > f.start) {
    where.push(sql`NOT EXISTS (
      SELECT 1 FROM ${reservations} r
      WHERE r.car_id = ${cars.id} AND r.status IN ${ACTIVE_RES}
        AND daterange(r.start_date, r.end_date, '[)') && daterange(${f.start}::date, ${f.end}::date, '[)')
    )`);
  }
  const order =
    f.sort === "price_desc" ? [desc(cars.dailyPrice)] : f.sort === "newest" ? [desc(cars.year), desc(cars.createdAt)] : [asc(cars.dailyPrice), asc(cars.brand)];

  const rows = await db
    .select({
      id: cars.id,
      brand: cars.brand,
      model: cars.model,
      year: cars.year,
      category: cars.category,
      transmission: cars.transmission,
      fuel: cars.fuel,
      seats: cars.seats,
      doors: cars.doors,
      luggage: cars.luggage,
      colorHex: cars.colorHex,
      dailyPrice: cars.dailyPrice,
      airConditioning: cars.airConditioning,
      city: agencies.city,
      citySlug: agencies.slug,
      cover: sql<string | null>`(SELECT ci.url FROM ${carImages} ci WHERE ci.car_id = ${cars.id} ORDER BY ci.position LIMIT 1)`,
    })
    .from(cars)
    .innerJoin(agencies, eq(agencies.id, cars.agencyId))
    .where(and(...where))
    .orderBy(...order)
    .limit(f.limit ?? 60);
  return rows;
}

export type PublicCar = Awaited<ReturnType<typeof listPublicCars>>[number];

export async function getPublicCar(id: string, locale: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const car = await db.query.cars.findFirst({
    where: and(eq(cars.id, id), eq(cars.status, "active")),
    with: {
      agency: true,
      images: { orderBy: [asc(carImages.position)] },
      translations: { where: inArray(carTranslations.locale, [locale as "fr", "fr"]) },
    },
  });
  if (!car) return null;
  const description =
    car.translations.find((t) => t.locale === locale)?.description ?? car.translations.find((t) => t.locale === "fr")?.description ?? null;
  return { ...car, description };
}

/** Périodes déjà prises (pour griser le calendrier de réservation). */
export async function getBookedRanges(carId: string) {
  return db
    .select({ start: reservations.startDate, end: reservations.endDate })
    .from(reservations)
    .where(
      and(
        eq(reservations.carId, carId),
        inArray(reservations.status, ["pending", "confirmed", "ongoing"]),
        gte(reservations.endDate, sql`CURRENT_DATE`),
      ),
    )
    .orderBy(asc(reservations.startDate));
}

export async function listAgencies() {
  return db.select().from(agencies).where(eq(agencies.isActive, true)).orderBy(asc(agencies.id));
}
