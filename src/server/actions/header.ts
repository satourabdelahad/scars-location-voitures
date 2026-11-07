"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { agencyScope } from "@/server/agency-scope";
import { getAlertSettings } from "@/server/app-settings";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { pgArray } from "@/lib/utils";

const ONLINE_MS = 5 * 60_000;

export type TeamMember = { id: string; name: string; photoUrl: string | null; role: "admin" | "manager"; online: boolean; lastSeen: string | null };

/** Équipe (administrateur et gestionnaires actifs) avec leur état de connexion : en ligne si actif depuis moins de 5 min. */
export async function teamPresence(): Promise<ActionResult<TeamMember[]>> {
  try {
    await assertRole(["admin", "manager"]);
    const res = await db.execute<{ id: string; name: string; photo_url: string | null; role: "admin" | "manager"; last_seen_at: string | null }>(sql`
      SELECT m.id, m.first_name || ' ' || m.last_name AS name, m.photo_url, u.role, u.last_seen_at
      FROM managers m JOIN users u ON u.id = m.user_id
      WHERE m.status = 'active' AND u.role IN ('admin', 'manager')
      ORDER BY u.last_seen_at DESC NULLS LAST, m.last_name`);
    const now = Date.now();
    return {
      ok: true,
      data: res.rows.map((r) => {
        const seen = r.last_seen_at ? new Date(r.last_seen_at) : null;
        return { id: r.id, name: r.name, photoUrl: r.photo_url, role: r.role, online: Boolean(seen && now - seen.getTime() < ONLINE_MS), lastSeen: seen?.toISOString() ?? null };
      }),
    };
  } catch (err) {
    return toActionError(err);
  }
}

export type NotificationKind = "booking" | "rental" | "available" | "extension" | "manager" | "deal" | "car";
export type NotificationItem = { key: string; kind: NotificationKind; at: string; who: string; what: string; href: string; unread: boolean };

/** Voitures du périmètre du gestionnaire (SQL), ou toutes. */
function carFilter(alias: string, scope: number[] | null) {
  if (!scope) return sql`true`;
  return sql`(${sql.raw(alias)}.agency_id = ANY(${pgArray(scope)}::int[]) OR EXISTS (SELECT 1 FROM car_agencies ca WHERE ca.car_id = ${sql.raw(alias)}.id AND ca.agency_id = ANY(${pgArray(scope)}::int[])))`;
}

/**
 * Notifications = événements récents de l'activité : réservation, location, voiture à nouveau disponible,
 * prolongation, nouveau gestionnaire, nouveau prospect, nouvelle voiture. Non lus : après la dernière ouverture du menu.
 */
export async function notifications(): Promise<ActionResult<{ items: NotificationItem[]; unread: number }>> {
  try {
    const user = await assertRole(["admin", "manager"]);
    const base = user.role === "admin" ? "/admin" : "/manager";
    const scope = await agencyScope(user);
    const [me] = await db.select({ seen: users.notificationsSeenAt }).from(users).where(eq(users.id, user.id)).limit(1);
    const res = await db.execute<{ key: string; kind: NotificationKind; at: string; who: string; what: string; target: string; actor: string | null }>(sql`
      SELECT * FROM (
        SELECT 'b' || r.id AS key, 'booking' AS kind, r.created_at AS at, r.driver_first_name || ' ' || r.driver_last_name AS who,
               c.brand || ' ' || c.model AS what, 'reservations/' || r.id AS target, NULL::uuid AS actor
          FROM reservations r JOIN cars c ON c.id = r.car_id WHERE ${carFilter("c", scope)}
        UNION ALL
        SELECT 'p' || r.id, 'rental', r.picked_up_at, r.driver_first_name || ' ' || r.driver_last_name, c.brand || ' ' || c.model, 'reservations/' || r.id, NULL
          FROM reservations r JOIN cars c ON c.id = r.car_id WHERE r.picked_up_at IS NOT NULL AND ${carFilter("c", scope)}
        UNION ALL
        SELECT 'r' || r.id, 'available', r.returned_at, r.driver_first_name || ' ' || r.driver_last_name, c.brand || ' ' || c.model, 'fleet/' || c.id, NULL
          FROM reservations r JOIN cars c ON c.id = r.car_id WHERE r.returned_at IS NOT NULL AND ${carFilter("c", scope)}
        UNION ALL
        SELECT 'm' || l.id, 'available', l.created_at, '', c.brand || ' ' || c.model, 'fleet/' || c.id, l.actor_id
          FROM audit_logs l JOIN cars c ON c.id::text = l.entity_id WHERE l.entity = 'car' AND l.action = 'repair_end' AND ${carFilter("c", scope)}
        UNION ALL
        SELECT 'x' || l.id, 'extension', l.created_at, r.driver_first_name || ' ' || r.driver_last_name, c.brand || ' ' || c.model, 'reservations/' || r.id, l.actor_id
          FROM audit_logs l JOIN reservations r ON r.id::text = l.entity_id JOIN cars c ON c.id = r.car_id
          WHERE l.entity = 'reservation' AND l.action = 'extend' AND ${carFilter("c", scope)}
        UNION ALL
        SELECT 'g' || m.id, 'manager', m.created_at, m.first_name || ' ' || m.last_name, '', 'managers/' || m.id, m.created_by
          FROM managers m JOIN users u ON u.id = m.user_id WHERE u.role = 'manager'
        UNION ALL
        SELECT 'd' || d.id, 'deal', d.created_at, d.prospect_name, '', 'clients/' || d.client_id, d.created_by
          FROM deals d ${user.role === "admin" ? sql`` : sql`WHERE d.manager_id = (SELECT id FROM managers WHERE user_id = ${user.id}) OR d.created_by = ${user.id}`}
        UNION ALL
        SELECT 'c' || c.id, 'car', c.created_at, '', c.brand || ' ' || c.model, 'fleet/' || c.id, c.created_by
          FROM cars c WHERE ${carFilter("c", scope)}
      ) e
      WHERE e.at > now() - interval '30 days'
      ORDER BY e.at DESC
      LIMIT 40`);
    const seen = me?.seen?.getTime() ?? 0;
    const items = res.rows.map((r) => {
      const at = new Date(r.at);
      return {
        key: r.key,
        kind: r.kind,
        at: at.toISOString(),
        who: r.who,
        what: r.what,
        // Les gestionnaires n'ont pas de liste des gestionnaires : on les envoie vers leur tableau de bord.
        href: base === "/manager" && r.target.startsWith("managers/") ? base : `${base}/${r.target}`,
        unread: at.getTime() > seen && r.actor !== user.id,
      };
    });
    return { ok: true, data: { items, unread: items.filter((i) => i.unread).length } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function markNotificationsSeen(): Promise<ActionResult> {
  try {
    const user = await assertRole(["admin", "manager"]);
    await db.update(users).set({ notificationsSeenAt: new Date() }).where(eq(users.id, user.id));
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export type AlertKind = "available" | "repair" | "insurance" | "oil_change" | "vignette" | "technical_inspection";
export type AlertItem = { key: string; kind: AlertKind; car: string; plate: string; href: string; date: string | null; days: number | null; km: number | null };

/**
 * Alertes : voitures à nouveau disponibles, en réparation, et échéances proches ou dépassées
 * (assurance, vidange en jours ou en km, vignette, visite technique), selon les seuils de l'administrateur.
 */
export async function alerts(): Promise<ActionResult<{ items: AlertItem[]; settings: Awaited<ReturnType<typeof getAlertSettings>> }>> {
  try {
    const user = await assertRole(["admin", "manager"]);
    const base = user.role === "admin" ? "/admin" : "/manager";
    const [scope, cfg] = await Promise.all([agencyScope(user), getAlertSettings()]);
    const res = await db.execute<{ kind: AlertKind; car_id: string; car: string; plate: string; date: string | null; km: number | null }>(sql`
      WITH scoped AS (SELECT c.* FROM cars c WHERE c.status <> 'deactivated' AND ${carFilter("c", scope)}),
      last_rec AS (
        SELECT DISTINCT ON (car_id, kind) car_id, kind, valid_until, next_mileage
        FROM car_records WHERE voided_at IS NULL AND kind <> 'expense'
        ORDER BY car_id, kind, performed_on DESC, created_at DESC)
      SELECT 'repair'::text AS kind, c.id AS car_id, c.brand || ' ' || c.model AS car, c.plate_number AS plate, c.updated_at::date::text AS date, NULL::int AS km
        FROM scoped c WHERE c.status = 'maintenance'
      UNION ALL
      SELECT 'available', c.id, c.brand || ' ' || c.model, c.plate_number, ev.at::date::text, NULL
        FROM scoped c
        JOIN LATERAL (
          SELECT max(at) AS at FROM (
            SELECT r.returned_at AS at FROM reservations r WHERE r.car_id = c.id AND r.returned_at IS NOT NULL
            UNION ALL SELECT l.created_at FROM audit_logs l WHERE l.entity = 'car' AND l.entity_id = c.id::text AND l.action = 'repair_end') x
        ) ev ON ev.at > now() - make_interval(hours => ${cfg.availableHours}::int)
        WHERE c.status = 'active' AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.car_id = c.id AND r.status = 'ongoing')
      UNION ALL
      SELECT l.kind::text, c.id, c.brand || ' ' || c.model, c.plate_number, l.valid_until::text,
             CASE WHEN l.kind = 'oil_change' AND l.next_mileage IS NOT NULL THEN l.next_mileage - c.mileage END
        FROM scoped c JOIN last_rec l ON l.car_id = c.id
        WHERE (l.kind = 'insurance' AND l.valid_until <= current_date + ${cfg.insuranceDays}::int)
           OR (l.kind = 'vignette' AND l.valid_until <= current_date + ${cfg.vignetteDays}::int)
           OR (l.kind = 'technical_inspection' AND l.valid_until <= current_date + ${cfg.inspectionDays}::int)
           OR (l.kind = 'oil_change' AND (l.valid_until <= current_date + ${cfg.oilDays}::int OR (l.next_mileage IS NOT NULL AND l.next_mileage - c.mileage <= ${cfg.oilKm}::int)))`);
    const tabFor: Record<AlertKind, string> = { available: "calendar", repair: "infos", insurance: "insurance", oil_change: "oil_change", vignette: "vignette", technical_inspection: "technical_inspection" };
    const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
    const items = res.rows
      .map((r) => ({
        key: `${r.kind}-${r.car_id}`,
        kind: r.kind,
        car: r.car,
        plate: r.plate,
        href: `${base}/fleet/${r.car_id}?tab=${tabFor[r.kind]}`,
        date: r.date,
        days: r.date && !["repair", "available"].includes(r.kind) ? Math.round((new Date(r.date).getTime() - today) / 86_400_000) : null,
        km: r.km == null ? null : Number(r.km),
      }))
      // Les plus urgentes d'abord : échéances dépassées, puis les plus proches.
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
    return { ok: true, data: { items, settings: cfg } };
  } catch (err) {
    return toActionError(err);
  }
}
