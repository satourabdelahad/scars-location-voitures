import "server-only";
import { sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { ActionError, type SessionUser } from "@/server/guards";

/**
 * Périmètre d'action d'un gestionnaire : les agences où il est rattaché (membre ou responsable).
 * null = aucune restriction (administrateur, ou gestionnaire rattaché à aucune agence).
 */
export async function agencyScope(user: { id: string; role: string }): Promise<number[] | null> {
  if (user.role === "admin") return null;
  const res = await db.execute<{ agency_id: number }>(sql`
    SELECT ma.agency_id FROM manager_agencies ma JOIN managers m ON m.id = ma.manager_id WHERE m.user_id = ${user.id}`);
  const ids = res.rows.map((r) => Number(r.agency_id));
  return ids.length ? ids : null;
}

/** Refuse si l'agence est hors du périmètre du gestionnaire. */
export async function assertAgencyInScope(user: SessionUser, agencyId: number, scope?: number[] | null) {
  const s = scope === undefined ? await agencyScope(user) : scope;
  if (s && !s.includes(agencyId)) throw new ActionError("out_of_scope");
}

/** Refuse si une des voitures n'a ni son agence principale ni une agence supplémentaire dans le périmètre. */
export async function assertCarsInScope(user: SessionUser, carIds: string[], scope?: number[] | null) {
  const s = scope === undefined ? await agencyScope(user) : scope;
  if (!s || !carIds.length) return;
  const res = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM cars c
    WHERE c.id = ANY(${carIds}::uuid[])
      AND NOT (c.agency_id = ANY(${s}::int[]))
      AND NOT EXISTS (SELECT 1 FROM car_agencies ca WHERE ca.car_id = c.id AND ca.agency_id = ANY(${s}::int[]))`);
  if ((res.rows[0]?.n ?? 0) > 0) throw new ActionError("out_of_scope");
}

/** Refuse si la voiture de la réservation est hors du périmètre. */
export async function assertReservationInScope(user: SessionUser, reservationId: string) {
  const s = await agencyScope(user);
  if (!s) return;
  const res = await db.execute<{ car_id: string }>(sql`SELECT car_id FROM reservations WHERE id = ${reservationId}`);
  if (res.rows[0]) await assertCarsInScope(user, [res.rows[0].car_id], s);
}

/** Périmètre de l'utilisateur connecté (pages serveur) ; null = sans restriction. */
export async function currentAgencyScope(): Promise<number[] | null> {
  const session = await auth();
  return session?.user ? agencyScope(session.user) : null;
}
