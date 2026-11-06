"use server";

import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/db";
import { agencies as agenciesTable, auditLogs, managerAgencies, carManagers, cars, managerCarRules, managerDocuments, managerEvents, managers, tablePreferences, users, type DocumentKind } from "@/db/schema";
import { managerSchema } from "@/lib/validation";
import { actorLabel, assertRole, toActionError, type ActionResult } from "@/server/guards";
import { notifyManagerInvite, notifyManagerJoinedAgencies, notifyManagerPasswordSet } from "@/server/notifications";
import bcrypt from "bcryptjs";
import { issuePasswordToken } from "@/server/tokens";
import { documentViewUrl, verifyUpload } from "@/server/uploads";
import { resolvePhoto, type PhotoInput } from "@/server/photo";
import { INVITATION_PENDING } from "@/lib/manager-status";
import { applyManagerRule, recountManagers } from "@/server/car-assignments";

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
    const admin = await assertRole(["admin"]);
    const list = z.array(z.string().uuid()).min(1).max(200).safeParse(ids);
    if (!list.success) return { ok: false, error: "validation" };
    if (action === "deactivate" && (reason ?? "").trim().length < 3) return { ok: false, error: "validation", fieldErrors: { reason: "minLength" } };
    const done: string[] = [];
    for (const id of list.data) {
      const r =
        action === "deactivate" ? await deactivateManager(id, reason ?? "") : action === "activate" ? await reactivateManager(id) : await resendManagerInvite(id);
      if (r.ok) done.push(id);
    }
    // Historique : une ligne pour l'action groupée, avec les noms des gestionnaires concernés.
    const names = done.length
      ? await db.select({ first: managers.firstName, last: managers.lastName }).from(managers).where(inArray(managers.id, done))
      : [];
    await db.insert(auditLogs).values({
      actorId: admin.id,
      entity: "manager",
      entityId: "bulk",
      action: `bulk_${action}`,
      changes: {
        note: [names.map((n) => `${n.first} ${n.last}`).join(", "), action === "deactivate" ? reason?.trim() : null].filter(Boolean).join(" · "),
        title: String(done.length),
        done,
        skipped: list.data.length - done.length,
      },
    });
    return { ok: true, data: { done, skipped: list.data.length - done.length } };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Affecte des voitures à un gestionnaire (onglet « Voitures affectées »). Une voiture sans gestionnaire
 * est partagée par tous ; dès qu'elle est affectée, seuls ses gestionnaires la suivent.
 * rule = true : les marques et villes choisies sont enregistrées comme règle ; toutes les voitures
 * actives qui correspondent lui sont affectées, y compris celles ajoutées plus tard au parc.
 */
export async function assignCarsToManager(
  managerId: string,
  input: { carIds: string[]; brands?: string[]; cities?: string[]; agencies?: number[]; rule?: boolean },
): Promise<ActionResult<{ added: number }>> {
  try {
    const admin = await assertRole(["admin"]);
    const locale = await getLocale();
    const p = z
      .object({
        carIds: z.array(z.string().uuid()).max(500),
        brands: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
        cities: z.array(z.string().trim().min(1).max(120)).max(200).default([]),
        agencies: z.array(z.number().int().positive()).max(200).default([]),
        rule: z.boolean().default(false),
      })
      .safeParse(input);
    if (!p.success || !z.string().uuid().safeParse(managerId).success) return { ok: false, error: "validation" };
    const { carIds, brands, cities, agencies: agencyIds, rule } = p.data;
    if (rule ? !brands.length && !cities.length && !agencyIds.length : !carIds.length) return { ok: false, error: "validation" };
    const m = await db.query.managers.findFirst({ where: eq(managers.id, managerId), columns: { id: true } });
    if (!m) return { ok: false, error: "not_found" };

    let addedIds: string[];
    if (rule) {
      addedIds = (await applyManagerRule(managerId, brands, cities, admin.id, db, agencyIds)).added;
    } else {
      const list = await db.select({ id: cars.id }).from(cars).where(and(inArray(cars.id, carIds), ne(cars.status, "deactivated")));
      if (!list.length) return { ok: false, error: "validation" };
      const inserted = await db
        .insert(carManagers)
        .values(list.map((c) => ({ carId: c.id, managerId, source: "manual" })))
        .onConflictDoNothing()
        .returning({ carId: carManagers.carId });
      addedIds = inserted.map((i) => i.carId);
      await recountManagers([managerId]);
    }
    const labels = addedIds.length
      ? await db.select({ brand: cars.brand, model: cars.model, plate: cars.plateNumber }).from(cars).where(inArray(cars.id, addedIds))
      : [];
    const agencyNames = agencyIds.length ? (await db.select({ name: agenciesTable.name, city: agenciesTable.city }).from(agenciesTable).where(inArray(agenciesTable.id, agencyIds))).map((a) => `${a.city}, ${a.name}`) : [];
    const criteria = rule
      ? [brands.length ? brands.join(", ") : null, cities.length ? cities.join(", ") : null, agencyNames.length ? agencyNames.join(", ") : null].filter(Boolean).join(" · ")
      : null;
    if (addedIds.length || rule) {
      await db.insert(auditLogs).values({
        actorId: admin.id,
        entity: "manager",
        entityId: managerId,
        action: rule ? "assign_rule" : "assign_cars",
        changes: { note: [criteria, labels.map((c) => `${c.brand} ${c.model} (${c.plate})`).join(", ")].filter(Boolean).join(" → "), carIds: addedIds, brands, cities, agencies: agencyIds },
      });
    }
    revalidatePath(`/${locale}/admin/managers`, "layout");
    revalidatePath(`/${locale}/admin/fleet`, "layout");
    return { ok: true, data: { added: addedIds.length } };
  } catch (err) {
    return toActionError(err);
  }
}

/** Supprime la règle marque / ville : les voitures déjà affectées restent, les nouvelles ne sont plus ajoutées. */
export async function clearManagerRule(managerId: string): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const locale = await getLocale();
    await db.update(managerCarRules).set({ brands: [], cities: [], agencies: [], updatedBy: admin.id, updatedAt: new Date() }).where(eq(managerCarRules.managerId, managerId));
    await db.update(carManagers).set({ source: "manual" }).where(eq(carManagers.managerId, managerId));
    await db.insert(auditLogs).values({ actorId: admin.id, entity: "manager", entityId: managerId, action: "clear_rule" });
    revalidatePath(`/${locale}/admin/managers`, "layout");
    return { ok: true };
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
    await recountManagers([managerId]);
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

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{10,200}$/;

/**
 * L'administrateur choisit un nouveau mot de passe pour un gestionnaire (onglet « Mot de passe »).
 * Le gestionnaire reçoit un email avec ce mot de passe (modèle "Nouveau mot de passe").
 * Un gestionnaire encore invité est activé du même coup.
 */
export async function adminSetManagerPassword(managerId: string, input: { next: string; confirm: string }): Promise<ActionResult<{ emailed: boolean }>> {
  try {
    const admin = await assertRole(["admin"]);
    const locale = await getLocale();
    if (!PASSWORD_RE.test(input.next ?? "")) return { ok: false, error: "validation", fieldErrors: { next: "passwordWeak" } };
    if (input.next !== input.confirm) return { ok: false, error: "validation", fieldErrors: { confirm: "passwordMismatch" } };
    const m = await db.query.managers.findFirst({ where: eq(managers.id, managerId), columns: { id: true, userId: true, status: true, deactivationReason: true } });
    if (!m) return { ok: false, error: "not_found" };
    if (m.status === "deactivated" && m.deactivationReason !== INVITATION_PENDING) return { ok: false, error: "invalid_transition" };
    const hash = await bcrypt.hash(input.next, 12);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: hash, loginLockedUntil: null }).where(eq(users.id, m.userId));
      if (m.status === "deactivated") {
        await tx.update(managers).set({ status: "active", deactivationReason: null, deactivatedAt: null }).where(eq(managers.id, m.id));
        await tx.update(users).set({ status: "active" }).where(eq(users.id, m.userId));
        await tx.insert(managerEvents).values({ managerId: m.id, event: "activated", actorId: admin.id });
      }
      await tx.insert(auditLogs).values({ actorId: admin.id, entity: "manager", entityId: m.id, action: "password_set" });
    });
    const tb = await getTranslations({ locale, namespace: "Back" });
    const r = await notifyManagerPasswordSet(m.id, input.next, `${admin.name ?? admin.email ?? "Dizy Cars"} (${tb("roleAdmin")})`).catch((e) => {
      console.error("[email] nouveau mot de passe", e);
      return null;
    });
    revalidatePath(`/${locale}/admin/managers`, "layout");
    return { ok: true, data: { emailed: Boolean(r?.sent) } };
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

/**
 * Rattache un gestionnaire à une ou plusieurs agences (administrateur). Les gestionnaires des
 * agences ajoutées sont prévenus par email (modèle « Nouveau gestionnaire d'agence »).
 */
export async function setManagerAgencies(managerId: string, agencyIds: number[]): Promise<ActionResult<{ added: number; removed: number; emailed: number }>> {
  try {
    const admin = await assertRole(["admin"]);
    const ids = z.array(z.number().int().positive()).max(200).safeParse(agencyIds);
    if (!z.string().uuid().safeParse(managerId).success || !ids.success) return { ok: false, error: "validation" };
    const [m] = await db.select({ id: managers.id, status: managers.status }).from(managers).where(eq(managers.id, managerId)).limit(1);
    if (!m) return { ok: false, error: "not_found" };
    const wanted = [...new Set(ids.data)];
    const valid = wanted.length ? (await db.select({ id: agenciesTable.id }).from(agenciesTable).where(inArray(agenciesTable.id, wanted))).map((a) => a.id) : [];
    const before = (await db.select({ id: managerAgencies.agencyId }).from(managerAgencies).where(eq(managerAgencies.managerId, managerId))).map((r) => r.id);
    const added = valid.filter((id) => !before.includes(id));
    const removed = before.filter((id) => !valid.includes(id));
    await db.transaction(async (tx) => {
      if (removed.length) await tx.delete(managerAgencies).where(and(eq(managerAgencies.managerId, managerId), inArray(managerAgencies.agencyId, removed)));
      if (added.length) await tx.insert(managerAgencies).values(added.map((agencyId) => ({ managerId, agencyId, createdBy: admin.id }))).onConflictDoNothing();
      const names = async (list: number[]) =>
        list.length ? (await tx.select({ city: agenciesTable.city, name: agenciesTable.name }).from(agenciesTable).where(inArray(agenciesTable.id, list))).map((a) => `${a.city}, ${a.name}`) : [];
      const plus = await names(added);
      const minus = await names(removed);
      const note = [...plus.map((n) => `+ ${n}`), ...minus.map((n) => `− ${n}`)].join(" · ") || null;
      await tx.insert(auditLogs).values({ actorId: admin.id, entity: "manager", entityId: managerId, action: "agencies", changes: { added: plus, removed: minus, note } });
    });
    let emailed = 0;
    if (added.length && m.status === "active") {
      const r = await notifyManagerJoinedAgencies(managerId, added, await actorLabel(admin)).catch((e) => {
        console.error("[email] gestionnaire rattaché à une agence", e);
        return null;
      });
      emailed = r?.sent ?? 0;
    }
    revalidatePath("/", "layout");
    return { ok: true, data: { added: added.length, removed: removed.length, emailed } };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Onglet « Périmètre » : enregistre en une fois les agences du gestionnaire (équipe, emails)
 * et la règle des voitures suivies (marques, villes, agences). La règle est appliquée tout de
 * suite ; le résultat indique les voitures ajoutées et retirées pour l'afficher.
 */
export async function saveManagerPerimeter(
  managerId: string,
  input: { agencies: number[]; brands: string[]; cities: string[]; ruleAgencies: number[] },
): Promise<ActionResult<{ agenciesAdded: number; agenciesRemoved: number; emailed: number; carsAdded: number; carsRemoved: number }>> {
  try {
    const admin = await assertRole(["admin"]);
    const p = z
      .object({
        agencies: z.array(z.number().int().positive()).max(200),
        brands: z.array(z.string().trim().min(1).max(80)).max(100),
        cities: z.array(z.string().trim().min(1).max(120)).max(200),
        ruleAgencies: z.array(z.number().int().positive()).max(200),
      })
      .safeParse(input);
    if (!p.success || !z.string().uuid().safeParse(managerId).success) return { ok: false, error: "validation" };
    const { brands, cities } = p.data;
    const ruleAgencies = [...new Set(p.data.ruleAgencies)];

    // 1. Agences du gestionnaire (avec emails aux gestionnaires des agences ajoutées).
    const team = await setManagerAgencies(managerId, p.data.agencies);
    if (!team.ok) return { ok: false, error: team.error };

    // 2. Voitures suivies : seulement si la règle change.
    const [current] = await db.select().from(managerCarRules).where(eq(managerCarRules.managerId, managerId)).limit(1);
    const same = (a: (string | number)[], b: (string | number)[]) => a.length === b.length && a.every((x) => b.includes(x));
    const changed = !current || !same(current.brands, brands) || !same(current.cities, cities) || !same(current.agencies ?? [], ruleAgencies);
    let carsAdded = 0;
    let carsRemoved = 0;
    if (changed && (current || brands.length || cities.length || ruleAgencies.length)) {
      const res = await applyManagerRule(managerId, brands, cities, admin.id, db, ruleAgencies);
      carsAdded = res.added.length;
      carsRemoved = res.removed.length;
      const agencyNames = ruleAgencies.length
        ? (await db.select({ name: agenciesTable.name, city: agenciesTable.city }).from(agenciesTable).where(inArray(agenciesTable.id, ruleAgencies))).map((a) => `${a.city}, ${a.name}`)
        : [];
      const criteria = [brands.join(", "), cities.join(", "), agencyNames.join(", ")].filter(Boolean).join(" · ") || "—";
      await db.insert(auditLogs).values({
        actorId: admin.id,
        entity: "manager",
        entityId: managerId,
        action: "assign_rule",
        changes: { note: `${criteria} → +${carsAdded} / −${carsRemoved}`, carIds: res.added, removedCarIds: res.removed, brands, cities, agencies: ruleAgencies },
      });
    }
    revalidatePath("/", "layout");
    return {
      ok: true,
      data: { agenciesAdded: team.data!.added, agenciesRemoved: team.data!.removed, emailed: team.data!.emailed, carsAdded, carsRemoved },
    };
  } catch (err) {
    return toActionError(err);
  }
}
