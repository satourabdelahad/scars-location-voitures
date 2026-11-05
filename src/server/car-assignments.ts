import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { agencies, carManagers, cars, managerCarRules } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

/** Une voiture correspond à la règle si sa marque ET sa ville font partie des choix (un critère vide = tous). */
export function matchesRule(rule: { brands: string[]; cities: string[] }, car: { brand: string; city: string }) {
  if (!rule.brands.length && !rule.cities.length) return false;
  const okBrand = !rule.brands.length || rule.brands.some((b) => norm(b) === norm(car.brand));
  const okCity = !rule.cities.length || rule.cities.some((c) => norm(c) === norm(car.city));
  return okBrand && okCity;
}

/** Recalcule et enregistre le nombre de voitures affectées à chaque gestionnaire indiqué. */
export async function recountManagers(ids: string[], q: Db = db) {
  for (const managerId of [...new Set(ids)]) {
    const [{ n }] = await q.select({ n: sql<number>`count(*)::int` }).from(carManagers).where(eq(carManagers.managerId, managerId));
    await q
      .insert(managerCarRules)
      .values({ managerId, carCount: n })
      .onConflictDoUpdate({ target: managerCarRules.managerId, set: { carCount: n, updatedAt: new Date() } });
  }
}

/**
 * Après l'ajout, la modification ou la désactivation d'une voiture : ajoute ou retire la voiture
 * des listes des gestionnaires selon leurs règles, puis recalcule leurs nombres de voitures.
 */
export async function syncCarAssignments(carId: string, q: Db = db) {
  const [car] = await q
    .select({ brand: cars.brand, status: cars.status, city: agencies.city })
    .from(cars)
    .innerJoin(agencies, eq(agencies.id, cars.agencyId))
    .where(eq(cars.id, carId))
    .limit(1);
  if (!car) return;
  const links = await q.select({ managerId: carManagers.managerId, source: carManagers.source }).from(carManagers).where(eq(carManagers.carId, carId));
  const touched = links.map((l) => l.managerId);

  if (car.status === "deactivated") {
    // Voiture désactivée : elle sort de la liste de tous ses gestionnaires.
    if (links.length) await q.delete(carManagers).where(eq(carManagers.carId, carId));
    await recountManagers(touched, q);
    return;
  }

  const rules = await q.select().from(managerCarRules);
  const linked = new Map(links.map((l) => [l.managerId, l.source]));
  for (const rule of rules) {
    const match = matchesRule(rule, car);
    const source = linked.get(rule.managerId);
    if (match && !source) {
      await q.insert(carManagers).values({ carId, managerId: rule.managerId, source: "rule" }).onConflictDoNothing();
      touched.push(rule.managerId);
    } else if (!match && source === "rule") {
      await q.delete(carManagers).where(and(eq(carManagers.carId, carId), eq(carManagers.managerId, rule.managerId)));
      touched.push(rule.managerId);
    }
  }
  await recountManagers(touched, q);
}

/**
 * Enregistre la règle d'un gestionnaire (marques, villes) et applique-la tout de suite :
 * toutes les voitures actives qui correspondent lui sont affectées, celles ajoutées par
 * l'ancienne règle et qui ne correspondent plus sont retirées. Les affectations manuelles restent.
 */
export async function applyManagerRule(managerId: string, brands: string[], cities: string[], actorId: string, q: Db = db) {
  await q
    .insert(managerCarRules)
    .values({ managerId, brands, cities, updatedBy: actorId })
    .onConflictDoUpdate({ target: managerCarRules.managerId, set: { brands, cities, updatedBy: actorId, updatedAt: new Date() } });
  const active = await q
    .select({ id: cars.id, brand: cars.brand, city: agencies.city })
    .from(cars)
    .innerJoin(agencies, eq(agencies.id, cars.agencyId))
    .where(ne(cars.status, "deactivated"));
  const wanted = active.filter((c) => matchesRule({ brands, cities }, c)).map((c) => c.id);
  const ruleLinks = await q
    .select({ carId: carManagers.carId })
    .from(carManagers)
    .where(and(eq(carManagers.managerId, managerId), eq(carManagers.source, "rule")));
  const stale = ruleLinks.map((l) => l.carId).filter((id) => !wanted.includes(id));
  if (stale.length) await q.delete(carManagers).where(and(eq(carManagers.managerId, managerId), inArray(carManagers.carId, stale)));
  const added = wanted.length
    ? await q
        .insert(carManagers)
        .values(wanted.map((carId) => ({ carId, managerId, source: "rule" })))
        .onConflictDoNothing()
        .returning({ carId: carManagers.carId })
    : [];
  await recountManagers([managerId], q);
  return { added: added.map((a) => a.carId), removed: stale };
}
