"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { agencies, auditLogs, cars } from "@/db/schema";
import { agencySchema } from "@/lib/validation";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";

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

/** Nouvelle agence (administrateur et gestionnaires). */
export async function createAgency(input: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
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
    const staff = await assertRole(["admin", "manager"]);
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
