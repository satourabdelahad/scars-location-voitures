"use server";

import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, carManagers, cars, managerDocuments, managerEvents, managers, tablePreferences, users, type DocumentKind } from "@/db/schema";
import { managerSchema } from "@/lib/validation";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { notifyManagerInvite } from "@/server/notifications";
import { issuePasswordToken } from "@/server/tokens";
import { documentViewUrl, verifyUpload } from "@/server/uploads";
import { resolvePhoto, type PhotoInput } from "@/server/photo";
import { INVITATION_PENDING } from "@/lib/manager-status";

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

export async function createManager(input: { data: unknown; documents: unknown; photo?: PhotoInput }): Promise<ActionResult<{ id: string }>> {
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

    const photo = (await resolvePhoto(input.photo)) ?? { photoUrl: null, photoPublicId: null };
    const id = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        // Compte inactif tant que le gestionnaire n'a pas cliqué sur le lien d'activation de l'invitation.
        .values({ name: `${d.firstName} ${d.lastName}`, email: d.email, role: "manager", phone: d.phone, image: photo.photoUrl, status: "deactivated" })
        .returning({ id: users.id });
      const [m] = await tx
        .insert(managers)
        .values({ ...d, ...photo, maritalStatus: d.maritalStatus ?? null, status: "deactivated", deactivationReason: INVITATION_PENDING, deactivatedAt: new Date(), userId: u.id, createdBy: admin.id, adminUpdatedAt: new Date(), adminUpdatedBy: admin.id })
        .returning({ id: managers.id });
      await attachDocuments(tx, m.id, docs.data, admin.id);
      await tx.insert(managerEvents).values({ managerId: m.id, event: "created", actorId: admin.id });
      return { managerId: m.id, userId: u.id };
    });

    const token = await issuePasswordToken(id.userId, "invite");
    await notifyManagerInvite(id.managerId, token, locale);
    revalidatePath(`/${locale}/admin/managers`);
    return { ok: true, data: { id: id.managerId } };
  } catch (err) {
    return toActionError(err);
  }
}

const TRACKED = ["civility", "lastName", "firstName", "phone", "whatsapp", "city", "birthDate", "maritalStatus", "workStartDate", "contractType"] as const;

export async function updateManager(id: string, input: { data: unknown; documents: unknown; photo?: PhotoInput }): Promise<ActionResult> {
  try {
    // L'administrateur modifie toutes les fiches ; un gestionnaire modifie la sienne (sauf date de début et contrat).
    const admin = await assertRole(["admin", "manager"]);
    const isAdmin = admin.role === "admin";
    const locale = await getLocale();
    const parsed = managerSchema.safeParse(input.data);
    const docs = docsSchema.safeParse(input.documents ?? {});
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: issuesToFields(parsed.error.issues) };
    if (!docs.success) return { ok: false, error: "validation" };

    const current = await db.query.managers.findFirst({ where: eq(managers.id, id), with: { user: true, documents: true } });
    if (!current) return { ok: false, error: "not_found" };
    if (!isAdmin && current.userId !== admin.id) return { ok: false, error: "forbidden" };
    if (!isAdmin && current.status !== "active") return { ok: false, error: "forbidden" };
    const d = isAdmin ? parsed.data : { ...parsed.data, workStartDate: current.workStartDate, contractType: current.contractType };
    if (d.email !== current.user.email) {
      const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
      if (taken && taken.id !== current.userId) return { ok: false, error: "unique:users_email_unique", fieldErrors: { email: "unique:users_email_unique" } };
    }

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

    const photo = await resolvePhoto(input.photo);
    if (photo && photo.photoPublicId !== current.photoPublicId) changes.photo = { from: current.photoPublicId ? "…" : null, to: photo.photoPublicId ? "new" : null };

    await db.transaction(async (tx) => {
      await tx
        .update(managers)
        .set({ ...d, ...(photo ?? {}), maritalStatus: d.maritalStatus ?? null, ...(isAdmin ? { adminUpdatedAt: new Date(), adminUpdatedBy: admin.id } : {}) })
        .where(eq(managers.id, id));
      await tx
        .update(users)
        .set({ email: d.email, name: `${d.firstName} ${d.lastName}`, phone: d.phone, ...(photo ? { image: photo.photoUrl } : {}) })
        .where(eq(users.id, current.userId));
      await attachDocuments(tx, id, docs.data, admin.id);
      if (Object.keys(changes).length) await tx.insert(managerEvents).values({ managerId: id, event: "updated", changes, actorId: admin.id });
    });
    revalidatePath(`/${locale}/admin/managers`, "layout");
    revalidatePath(`/${locale}/manager`, "layout");
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
        .where(and(eq(managers.id, id), eq(managers.status, "deactivated"), or(isNull(managers.deactivationReason), ne(managers.deactivationReason, INVITATION_PENDING))))
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
    // Possible tant que le gestionnaire n'a pas activé son compte (aucun mot de passe).
    if (!m || !m.user.email || m.user.passwordHash) return { ok: false, error: "invalid_transition" };
    const token = await issuePasswordToken(m.userId, "invite");
    await notifyManagerInvite(m.id, token, locale);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Action groupée depuis le tableau : chaque ligne est traitée séparément, celles qui ne s'appliquent pas sont ignorées. */
export async function bulkManagerAction(
  ids: string[],
  action: "deactivate" | "activate" | "resend",
  reason?: string,
): Promise<ActionResult<{ done: string[]; skipped: number }>> {
  try {
    await assertRole(["admin"]);
    const list = z.array(z.string().uuid()).min(1).max(200).safeParse(ids);
    if (!list.success) return { ok: false, error: "validation" };
    if (action === "deactivate" && (reason ?? "").trim().length < 3) return { ok: false, error: "validation", fieldErrors: { reason: "minLength" } };
    const done: string[] = [];
    for (const id of list.data) {
      const r =
        action === "deactivate" ? await deactivateManager(id, reason ?? "") : action === "activate" ? await reactivateManager(id) : await resendManagerInvite(id);
      if (r.ok) done.push(id);
    }
    return { ok: true, data: { done, skipped: list.data.length - done.length } };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Affecte des voitures à un gestionnaire (onglet « Voitures affectées »). Une voiture sans gestionnaire
 * est partagée par tous ; dès qu'elle est affectée, seuls ses gestionnaires la suivent.
 */
export async function assignCarsToManager(managerId: string, carIds: string[]): Promise<ActionResult<{ added: number }>> {
  try {
    const admin = await assertRole(["admin"]);
    const locale = await getLocale();
    const ids = z.array(z.string().uuid()).min(1).max(500).safeParse(carIds);
    if (!ids.success || !z.string().uuid().safeParse(managerId).success) return { ok: false, error: "validation" };
    const m = await db.query.managers.findFirst({ where: eq(managers.id, managerId), columns: { id: true } });
    if (!m) return { ok: false, error: "not_found" };
    const list = await db
      .select({ id: cars.id, label: cars.brand, model: cars.model, plate: cars.plateNumber })
      .from(cars)
      .where(and(inArray(cars.id, ids.data), ne(cars.status, "deactivated")));
    if (!list.length) return { ok: false, error: "validation" };
    const inserted = await db
      .insert(carManagers)
      .values(list.map((c) => ({ carId: c.id, managerId })))
      .onConflictDoNothing()
      .returning({ carId: carManagers.carId });
    if (inserted.length) {
      const added = new Set(inserted.map((i) => i.carId));
      const note = list.filter((c) => added.has(c.id)).map((c) => `${c.label} ${c.model} (${c.plate})`).join(", ");
      await db.insert(auditLogs).values({ actorId: admin.id, entity: "manager", entityId: managerId, action: "assign_cars", changes: { note, carIds: [...added] } });
    }
    revalidatePath(`/${locale}/admin/managers`, "layout");
    revalidatePath(`/${locale}/admin/fleet`, "layout");
    return { ok: true, data: { added: inserted.length } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function unassignCarFromManager(managerId: string, carId: string): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const locale = await getLocale();
    const [row] = await db
      .delete(carManagers)
      .where(and(eq(carManagers.managerId, managerId), eq(carManagers.carId, carId)))
      .returning({ carId: carManagers.carId });
    if (!row) return { ok: false, error: "not_found" };
    const [c] = await db.select({ brand: cars.brand, model: cars.model, plate: cars.plateNumber }).from(cars).where(eq(cars.id, carId));
    await db.insert(auditLogs).values({
      actorId: admin.id,
      entity: "manager",
      entityId: managerId,
      action: "unassign_car",
      changes: { note: c ? `${c.brand} ${c.model} (${c.plate})` : carId, carId },
    });
    revalidatePath(`/${locale}/admin/managers`, "layout");
    revalidatePath(`/${locale}/admin/fleet`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Lien temporaire vers une pièce d'identité (jamais d'URL publique permanente). */
export async function getManagerDocumentUrl(managerId: string, kind: DocumentKind): Promise<ActionResult<{ url: string }>> {
  try {
    const me = await assertRole(["admin", "manager"]);
    // Un gestionnaire ne consulte que ses propres pièces.
    if (me.role === "manager") {
      const [own] = await db.select({ id: managers.id }).from(managers).where(and(eq(managers.id, managerId), eq(managers.userId, me.id))).limit(1);
      if (!own) return { ok: false, error: "forbidden" };
    }
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
    // "!id" : colonne masquée par l'utilisateur (pour afficher les colonnes ajoutées plus tard).
    const cols = z.array(z.string().regex(/^!?[A-Za-z0-9_]{1,64}$/)).max(120).parse(visibleColumns);
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
