"use server";

import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { agencies, auditLogs, cars, managerAgencies, managers, users } from "@/db/schema";
import { agencySchema } from "@/lib/validation";
import { actorLabel, assertRole, toActionError, type ActionResult } from "@/server/guards";
import { notifyManagerJoinedAgencies } from "@/server/notifications";

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

/**
 * Recopie le premier responsable dans les colonnes historiques de l'agence (compatibilité, exports).
 * La source de vérité est manager_agencies.is_responsible.
 */
async function syncLegacyResponsible(agencyId: number) {
  const [m] = await db
    .select({ id: managers.id, civility: managers.civility, first: managers.firstName, last: managers.lastName, phone: managers.phone, email: users.email })
    .from(managerAgencies)
    .innerJoin(managers, eq(managers.id, managerAgencies.managerId))
    .innerJoin(users, eq(users.id, managers.userId))
    .where(and(eq(managerAgencies.agencyId, agencyId), eq(managerAgencies.isResponsible, true)))
    .orderBy(managers.lastName, managers.firstName)
    .limit(1);
  await db
    .update(agencies)
    .set(
      m
        ? { managerId: m.id, managerCivility: m.civility, managerFirstName: m.first, managerLastName: m.last, managerEmail: m.email, managerPhone: m.phone }
        : { managerId: null, managerCivility: null, managerFirstName: null, managerLastName: null, managerEmail: null, managerPhone: null },
    )
    .where(eq(agencies.id, agencyId));
}

/** Nouvelle agence : réservé à l'administrateur. */
export async function createAgency(input: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const staff = await assertRole(["admin"]);
    const p = agencySchema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(p.error) };
    const base = slugify(`${p.data.city}-${p.data.name}`) || "agence";
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(agencies).where(sql`${agencies.slug} LIKE ${base + "%"}`);
    const [row] = await db
      .insert(agencies)
      .values({ ...p.data, slug: n ? `${base}-${n + 1}` : base, createdBy: staff.id, updatedBy: staff.id })
      .returning({ id: agencies.id });
    await db.insert(auditLogs).values({ actorId: staff.id, entity: "agency", entityId: String(row.id), action: "create", changes: { name: p.data.name, city: p.data.city } });
    revalidatePath(`/${await getLocale()}`, "layout");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateAgency(id: number, input: unknown): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin"]);
    const p = agencySchema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(p.error) };
    const [row] = await db.update(agencies).set({ ...p.data, updatedBy: staff.id }).where(eq(agencies.id, id)).returning({ id: agencies.id });
    if (!row) return { ok: false, error: "not_found" };
    await db.insert(auditLogs).values({ actorId: staff.id, entity: "agency", entityId: String(id), action: "update", changes: p.data });
    revalidatePath(`/${await getLocale()}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Jamais de suppression : l'administrateur désactive l'agence avec un motif (elle disparaît du site public)
 * ou la réactive. Une agence qui a encore des voitures en service ne peut pas être désactivée.
 */
export async function setAgencyActive(id: number, active: boolean, reason?: string): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const r = z.string().trim().min(3).max(1000).safeParse(reason ?? "");
    if (!active && !r.success) return { ok: false, error: "validation", fieldErrors: { reason: "minLength" } };
    if (!active) {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(cars)
        .where(and(eq(cars.agencyId, id), ne(cars.status, "deactivated")));
      if (n > 0) return { ok: false, error: "agency_has_cars" };
    }
    const [row] = await db
      .update(agencies)
      .set({ isActive: active, deactivationReason: active ? null : r.data, updatedBy: admin.id })
      .where(eq(agencies.id, id))
      .returning({ id: agencies.id });
    if (!row) return { ok: false, error: "not_found" };
    await db.insert(auditLogs).values({ actorId: admin.id, entity: "agency", entityId: String(id), action: active ? "reactivate" : "deactivate", changes: active ? null : { reason: r.data } });
    revalidatePath(`/${await getLocale()}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Activation / désactivation groupée depuis la liste des agences. Les agences qui ont encore des voitures restent actives. */
export async function bulkAgencyStatus(ids: number[], active: boolean, reason?: string): Promise<ActionResult<{ done: number[]; skipped: number }>> {
  try {
    await assertRole(["admin"]);
    const list = z.array(z.number().int().positive()).min(1).max(300).safeParse(ids);
    if (!list.success) return { ok: false, error: "validation" };
    if (!active && !z.string().trim().min(3).max(1000).safeParse(reason ?? "").success) return { ok: false, error: "validation", fieldErrors: { reason: "minLength" } };
    const done: number[] = [];
    for (const id of list.data) {
      const r = await setAgencyActive(id, active, reason);
      if (r.ok) done.push(id);
    }
    return { ok: true, data: { done, skipped: list.data.length - done.length } };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Affectation depuis la fiche agence (administrateur) :
 * - kind "responsible" : responsables de l'agence (0, 1 ou plusieurs) ; ils en deviennent aussi membres.
 * - kind "member" : gestionnaires rattachés à l'agence ; les responsables restent toujours rattachés.
 * Les nouveaux membres sont annoncés aux gestionnaires de l'agence.
 */
export async function setAgencyManagers(agencyId: number, kind: "responsible" | "member", ids: string[]): Promise<ActionResult<{ added: number; removed: number }>> {
  try {
    const admin = await assertRole(["admin"]);
    const list = z.array(z.string().uuid()).max(500).safeParse(ids);
    if (!Number.isInteger(agencyId) || !list.success || !["responsible", "member"].includes(kind)) return { ok: false, error: "validation" };
    const [agency] = await db.select({ id: agencies.id }).from(agencies).where(eq(agencies.id, agencyId)).limit(1);
    if (!agency) return { ok: false, error: "not_found" };
    // L'administrateur appartient déjà à toutes les agences : il n'est rattaché que s'il est responsable.
    const adminIds = (await db.select({ id: managers.id }).from(managers).innerJoin(users, eq(users.id, managers.userId)).where(eq(users.role, "admin"))).map((r) => r.id);
    const wanted = [...new Set(list.data)];
    const before = await db.select({ id: managerAgencies.managerId, head: managerAgencies.isResponsible }).from(managerAgencies).where(eq(managerAgencies.agencyId, agencyId));
    const had = new Set(before.map((b) => b.id));
    let added: string[] = [];
    let removed: string[] = [];
    await db.transaction(async (tx) => {
      if (kind === "responsible") {
        added = wanted.filter((id) => !had.has(id) && !adminIds.includes(id));
        await tx.update(managerAgencies).set({ isResponsible: false }).where(and(eq(managerAgencies.agencyId, agencyId), wanted.length ? notInArray(managerAgencies.managerId, wanted) : sql`true`));
        if (wanted.length)
          await tx
            .insert(managerAgencies)
            .values(wanted.map((managerId) => ({ managerId, agencyId, isResponsible: true, createdBy: admin.id })))
            .onConflictDoUpdate({ target: [managerAgencies.managerId, managerAgencies.agencyId], set: { isResponsible: true } });
      } else {
        const heads = before.filter((b) => b.head).map((b) => b.id);
        const keep = new Set([...wanted.filter((id) => !adminIds.includes(id)), ...heads]);
        added = [...keep].filter((id) => !had.has(id));
        removed = before.map((b) => b.id).filter((id) => !keep.has(id));
        if (removed.length) await tx.delete(managerAgencies).where(and(eq(managerAgencies.agencyId, agencyId), inArray(managerAgencies.managerId, removed)));
        if (added.length) await tx.insert(managerAgencies).values(added.map((managerId) => ({ managerId, agencyId, createdBy: admin.id }))).onConflictDoNothing();
      }
      await tx.insert(auditLogs).values({ actorId: admin.id, entity: "agency", entityId: String(agencyId), action: kind === "responsible" ? "responsibles" : "managers", changes: { ids: wanted, added, removed } });
    });
    await syncLegacyResponsible(agencyId);
    const label = await actorLabel(admin);
    for (const id of added) await notifyManagerJoinedAgencies(id, [agencyId], label).catch((e) => console.error("[email] gestionnaire rattaché", e));
    revalidatePath(`/${await getLocale()}`, "layout");
    return { ok: true, data: { added: added.length, removed: removed.length } };
  } catch (err) {
    return toActionError(err);
  }
}
