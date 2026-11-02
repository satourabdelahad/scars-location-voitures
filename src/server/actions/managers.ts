"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db } from "@/db";
import { managerDocuments, managerEvents, managers, tablePreferences, users, type DocumentKind } from "@/db/schema";
import { managerSchema } from "@/lib/validation";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { sendManagerInvite } from "@/server/email";
import { issuePasswordToken } from "@/server/tokens";
import { documentViewUrl, verifyUpload } from "@/server/uploads";

const docSchema = z.object({ publicId: z.string().min(3).max(300), resourceType: z.enum(["image", "raw"]).default("image") });
const docsSchema = z.object({
  cin_front: docSchema.optional(),
  cin_back: docSchema.optional(),
  license_front: docSchema.optional(),
  license_back: docSchema.optional(),
});
const REQUIRED_DOCS: DocumentKind[] = ["cin_front", "cin_back"];

function issuesToFields(issues: z.core.$ZodIssue[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

async function attachDocuments(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  managerId: string,
  docs: z.infer<typeof docsSchema>,
  actorId: string,
) {
  for (const [kind, d] of Object.entries(docs) as [DocumentKind, z.infer<typeof docSchema> | undefined][]) {
    if (!d) continue;
    const v = await verifyUpload(d.publicId, "identity", d.resourceType);
    await tx
      .insert(managerDocuments)
      .values({ managerId, kind, publicId: v.publicId, resourceType: d.resourceType, format: v.format, bytes: v.bytes, uploadedBy: actorId })
      .onConflictDoUpdate({
        target: [managerDocuments.managerId, managerDocuments.kind],
        set: { publicId: v.publicId, resourceType: d.resourceType, format: v.format, bytes: v.bytes, uploadedBy: actorId, uploadedAt: new Date() },
      });
  }
}

export async function createManager(input: { data: unknown; documents: unknown }): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await assertRole(["admin"]);
    const locale = await getLocale();
    const parsed = managerSchema.safeParse(input.data);
    const docs = docsSchema.safeParse(input.documents ?? {});
    const fieldErrors: Record<string, string> = parsed.success ? {} : issuesToFields(parsed.error.issues);
    if (docs.success) for (const k of REQUIRED_DOCS) if (!docs.data[k]) fieldErrors[k] = "missingDocument";
    if (!parsed.success || !docs.success || Object.keys(fieldErrors).length) return { ok: false, error: "validation", fieldErrors };
    const d = parsed.data;

    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
    if (exists) return { ok: false, error: "unique:users_email_unique", fieldErrors: { email: "unique:users_email_unique" } };

    const id = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ name: `${d.firstName} ${d.lastName}`, email: d.email, role: "manager", phone: d.phone })
        .returning({ id: users.id });
      const [m] = await tx
        .insert(managers)
        .values({ ...d, maritalStatus: d.maritalStatus ?? null, userId: u.id, createdBy: admin.id, adminUpdatedAt: new Date(), adminUpdatedBy: admin.id })
        .returning({ id: managers.id });
      await attachDocuments(tx, m.id, docs.data, admin.id);
      await tx.insert(managerEvents).values({ managerId: m.id, event: "created", actorId: admin.id });
      return { managerId: m.id, userId: u.id };
    });

    const token = await issuePasswordToken(id.userId, "invite");
    await sendManagerInvite({ to: d.email, firstName: d.firstName, token, locale });
    revalidatePath(`/${locale}/admin/managers`);
    return { ok: true, data: { id: id.managerId } };
  } catch (err) {
    return toActionError(err);
  }
}

const TRACKED = ["civility", "lastName", "firstName", "phone", "whatsapp", "city", "birthDate", "maritalStatus", "workStartDate", "contractType"] as const;

export async function updateManager(id: string, input: { data: unknown; documents: unknown }): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const locale = await getLocale();
    const parsed = managerSchema.safeParse(input.data);
    const docs = docsSchema.safeParse(input.documents ?? {});
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: issuesToFields(parsed.error.issues) };
    if (!docs.success) return { ok: false, error: "validation" };
    const d = parsed.data;

    const current = await db.query.managers.findFirst({ where: eq(managers.id, id), with: { user: true, documents: true } });
    if (!current) return { ok: false, error: "not_found" };

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of TRACKED) {
      const before = current[k] ?? null;
      const after = d[k] ?? null;
      if (before !== after) changes[k] = { from: before, to: after };
    }
    if (current.user.email !== d.email) changes.email = { from: current.user.email, to: d.email };
    for (const kind of Object.keys(docs.data) as DocumentKind[]) if (docs.data[kind]) changes[`document:${kind}`] = { from: "…", to: "new" };

    // Les pièces obligatoires doivent toujours exister après modification.
    const missing = REQUIRED_DOCS.filter((k) => !docs.data[k] && !current.documents.some((x) => x.kind === k));
    if (missing.length) return { ok: false, error: "validation", fieldErrors: Object.fromEntries(missing.map((k) => [k, "missingDocument"])) };

    await db.transaction(async (tx) => {
      await tx
        .update(managers)
        .set({ ...d, maritalStatus: d.maritalStatus ?? null, adminUpdatedAt: new Date(), adminUpdatedBy: admin.id })
        .where(eq(managers.id, id));
      await tx.update(users).set({ email: d.email, name: `${d.firstName} ${d.lastName}`, phone: d.phone }).where(eq(users.id, current.userId));
      await attachDocuments(tx, id, docs.data, admin.id);
      if (Object.keys(changes).length) await tx.insert(managerEvents).values({ managerId: id, event: "updated", changes, actorId: admin.id });
    });
    revalidatePath(`/${locale}/admin/managers`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** On ne supprime jamais un gestionnaire : on le désactive avec un motif (obligatoire). */
export async function deactivateManager(id: string, reason: string): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const locale = await getLocale();
    const r = z.string().trim().min(3).max(1000).safeParse(reason);
    if (!r.success) return { ok: false, error: "validation", fieldErrors: { reason: "minLength" } };
    await db.transaction(async (tx) => {
      const [m] = await tx
        .update(managers)
        .set({ status: "deactivated", deactivationReason: r.data, deactivatedAt: new Date(), adminUpdatedAt: new Date(), adminUpdatedBy: admin.id })
        .where(and(eq(managers.id, id), eq(managers.status, "active")))
        .returning({ userId: managers.userId });
      if (!m) throw Object.assign(new Error("invalid_transition"), { code: "invalid" });
      await tx.update(users).set({ status: "deactivated" }).where(eq(users.id, m.userId));
      await tx.insert(managerEvents).values({ managerId: id, event: "deactivated", reason: r.data, actorId: admin.id });
    });
    revalidatePath(`/${locale}/admin/managers`, "layout");
    return { ok: true };
  } catch (err) {
    if ((err as Error).message === "invalid_transition") return { ok: false, error: "invalid_transition" };
    return toActionError(err);
  }
}

export async function reactivateManager(id: string): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const locale = await getLocale();
    await db.transaction(async (tx) => {
      const [m] = await tx
        .update(managers)
        .set({ status: "active", deactivationReason: null, deactivatedAt: null, adminUpdatedAt: new Date(), adminUpdatedBy: admin.id })
        .where(and(eq(managers.id, id), eq(managers.status, "deactivated")))
        .returning({ userId: managers.userId });
      if (!m) throw new Error("invalid_transition");
      await tx.update(users).set({ status: "active" }).where(eq(users.id, m.userId));
      await tx.insert(managerEvents).values({ managerId: id, event: "reactivated", actorId: admin.id });
    });
    revalidatePath(`/${locale}/admin/managers`, "layout");
    return { ok: true };
  } catch (err) {
    if ((err as Error).message === "invalid_transition") return { ok: false, error: "invalid_transition" };
    return toActionError(err);
  }
}

export async function resendManagerInvite(id: string): Promise<ActionResult> {
  try {
    await assertRole(["admin"]);
    const locale = await getLocale();
    const m = await db.query.managers.findFirst({ where: eq(managers.id, id), with: { user: true } });
    if (!m || m.status !== "active" || !m.user.email) return { ok: false, error: "not_found" };
    const token = await issuePasswordToken(m.userId, "invite");
    await sendManagerInvite({ to: m.user.email, firstName: m.firstName, token, locale });
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Lien temporaire vers une pièce d'identité (jamais d'URL publique permanente). */
export async function getManagerDocumentUrl(managerId: string, kind: DocumentKind): Promise<ActionResult<{ url: string }>> {
  try {
    await assertRole(["admin"]);
    const [doc] = await db
      .select()
      .from(managerDocuments)
      .where(and(eq(managerDocuments.managerId, managerId), eq(managerDocuments.kind, kind)))
      .limit(1);
    if (!doc) return { ok: false, error: "not_found" };
    const url = documentViewUrl(doc.publicId, doc.resourceType, doc.format);
    if (!url) return { ok: false, error: "cloudinary_not_configured" };
    return { ok: true, data: { url } };
  } catch (err) {
    return toActionError(err);
  }
}

/** Colonnes visibles et taille de page, mémorisées par utilisateur (table relationnelle, pas de stockage clé-valeur). */
export async function saveTablePreferences(tableKey: string, visibleColumns: string[], pageSize: number): Promise<ActionResult> {
  try {
    const user = await assertRole(["admin", "manager"]);
    const key = z.string().regex(/^[a-z0-9_-]{1,64}$/).parse(tableKey);
    const cols = z.array(z.string().regex(/^[A-Za-z0-9_]{1,64}$/)).max(60).parse(visibleColumns);
    const size = [25, 50, 100].includes(pageSize) ? pageSize : 25;
    await db
      .insert(tablePreferences)
      .values({ userId: user.id, tableKey: key, visibleColumns: cols, pageSize: size })
      .onConflictDoUpdate({
        target: [tablePreferences.userId, tablePreferences.tableKey],
        set: { visibleColumns: cols, pageSize: size, updatedAt: new Date() },
      });
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
