"use server";

import { recountManagers, syncCarAssignments } from "@/server/car-assignments";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, carImages, carManagers, carTranslations, cars, reservations } from "@/db/schema";
import { notifyCarCreated, notifyCarsJoinedAgency } from "@/server/notifications";
import { carDeactivationSchema, carSchema, LOCALE_CODES } from "@/lib/validation";
import { actorLabel, assertRole, toActionError, type ActionResult } from "@/server/guards";
import { verifyUpload } from "@/server/uploads";
import { assertAgencyInScope, assertCarsInScope } from "@/server/agency-scope";
import { sendReservationEmail } from "@/server/email";
import { formatDate, formatMoney } from "@/lib/utils";
import { CAR_VIEWS } from "@/lib/car-views";

const imagesSchema = z
  .array(
    z.object({
      publicId: z.string().min(3).max(300),
      url: z.string().max(600),
      width: z.number().nullable().optional(),
      height: z.number().nullable().optional(),
      /** Vue de la photo : principale (obligatoire), avant, arrière, côtés, dessus, intérieur… */
      view: z.enum(CAR_VIEWS).default("other"),
    }),
  )
  .max(20)
  // Une seule photo par vue (sauf « autres »), photo principale en premier.
  .transform((list) => {
    const seen = new Set<string>();
    const kept = list.filter((i) => i.view === "other" || (!seen.has(i.view) && (seen.add(i.view), true)));
    return kept.sort((a, b) => CAR_VIEWS.indexOf(a.view) - CAR_VIEWS.indexOf(b.view));
  });

function fieldErrors(issues: z.core.$ZodIssue[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function writeChildren(tx: Tx, carId: string, descriptions: Record<string, string>, images: z.infer<typeof imagesSchema>) {
  // Descriptions : une ligne par langue renseignée.
  const locales = LOCALE_CODES.filter((l) => (descriptions[l] ?? "").trim());
  await tx.delete(carTranslations).where(eq(carTranslations.carId, carId));
  if (locales.length)
    await tx.insert(carTranslations).values(locales.map((l) => ({ carId, locale: l, description: descriptions[l].trim() })));

  // Photos : on vérifie chaque nouveau fichier auprès du stockage avant de l'enregistrer.
  const existing = await tx.select().from(carImages).where(eq(carImages.carId, carId));
  const known = new Map(existing.map((i) => [i.publicId, i]));
  const keep = new Set(images.map((i) => i.publicId));
  const toRemove = existing.filter((i) => !keep.has(i.publicId)).map((i) => i.id);
  if (toRemove.length) await tx.delete(carImages).where(inArray(carImages.id, toRemove));
  for (const [position, img] of images.entries()) {
    const k = known.get(img.publicId);
    if (k) {
      if (k.position !== position || k.view !== img.view) await tx.update(carImages).set({ position, view: img.view }).where(eq(carImages.id, k.id));
    } else {
      const v = await verifyUpload(img.publicId, "car");
      await tx.insert(carImages).values({ carId, publicId: v.publicId, url: v.url, width: v.width, height: v.height, position, view: img.view });
    }
  }
}

const managerIdsSchema = z.array(z.string().uuid()).max(100).default([]);

/** Gestionnaires associés : on remplace la liste (vide = tous les gestionnaires). */
async function writeManagers(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], carId: string, ids: string[]) {
  // On garde l'origine (manuelle ou règle marque / ville) des gestionnaires déjà associés.
  const before = await tx.select({ managerId: carManagers.managerId, source: carManagers.source }).from(carManagers).where(eq(carManagers.carId, carId));
  const sources = new Map(before.map((b) => [b.managerId, b.source]));
  await tx.delete(carManagers).where(eq(carManagers.carId, carId));
  if (ids.length) await tx.insert(carManagers).values([...new Set(ids)].map((managerId) => ({ carId, managerId, source: sources.get(managerId) ?? "manual" })));
  await recountManagers([...before.map((b) => b.managerId), ...ids], tx);
}

export async function createCar(input: { data: unknown; images: unknown; managerIds?: unknown }): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const parsed = carSchema.safeParse(input.data);
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
    const images = imagesSchema.parse(input.images ?? []);
    // Photo principale obligatoire
    if (!images.some((i) => i.view === "main")) return { ok: false, error: "validation", fieldErrors: { images: "photoRequired" } };
    const managerIds = managerIdsSchema.parse(input.managerIds ?? []);
    const { descriptions, ...data } = parsed.data;
    // Gestionnaire rattaché à des agences : seulement des voitures de son périmètre.
    await assertAgencyInScope(staff, data.agencyId);
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(cars)
        .values({ ...data, vin: data.vin || null, createdBy: staff.id, updatedBy: staff.id })
        .returning({ id: cars.id });
      await writeChildren(tx, row.id, descriptions, images);
      await writeManagers(tx, row.id, managerIds);
      // Règles marque / ville des gestionnaires : la nouvelle voiture rejoint leurs listes.
      await syncCarAssignments(row.id, tx);
      await tx.insert(auditLogs).values({ actorId: staff.id, entity: "car", entityId: row.id, action: "create", changes: { ...data, managerIds } });
      return row.id;
    });
    await notifyCarCreated(id, staff.name ?? staff.email ?? "—").catch((e) => console.error("[email] nouvelle voiture", e));
    // Les gestionnaires de l'agence sont prévenus de la voiture associée à leur agence.
    await notifyCarsJoinedAgency([id], data.agencyId, await actorLabel(staff), staff.email).catch((e) => console.error("[email] voiture associée à une agence", e));
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateCar(id: string, input: { data: unknown; images: unknown; managerIds?: unknown }): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const parsed = carSchema.safeParse(input.data);
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
    const images = imagesSchema.parse(input.images ?? []);
    // Photo principale obligatoire
    if (!images.some((i) => i.view === "main")) return { ok: false, error: "validation", fieldErrors: { images: "photoRequired" } };
    const managerIds = managerIdsSchema.parse(input.managerIds ?? []);
    const { descriptions, ...data } = parsed.data;
    const [current] = await db.select({ status: cars.status, agencyId: cars.agencyId }).from(cars).where(eq(cars.id, id)).limit(1);
    if (!current) return { ok: false, error: "not_found" };
    // Contrôle applicatif ; la base le garantit aussi par un trigger.
    if (current.status === "deactivated") return { ok: false, error: "car_frozen" };
    await assertCarsInScope(staff, [id]);
    await assertAgencyInScope(staff, data.agencyId);
    await db.transaction(async (tx) => {
      await tx.update(cars).set({ ...data, vin: data.vin || null, updatedBy: staff.id }).where(eq(cars.id, id));
      await writeChildren(tx, id, descriptions, images);
      await writeManagers(tx, id, managerIds);
      await syncCarAssignments(id, tx);
      await tx.insert(auditLogs).values({ actorId: staff.id, entity: "car", entityId: id, action: "update", changes: { ...data, managerIds } });
    });
    if (current.agencyId !== data.agencyId)
      await notifyCarsJoinedAgency([id], data.agencyId, await actorLabel(staff), staff.email).catch((e) => console.error("[email] voiture associée à une agence", e));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Désactivation définitive (volée, vendue…). La voiture disparaît du site public, ses données sont figées,
 * et les réservations à venir sont annulées avec un email au client.
 */
export async function deactivateCar(id: string, input: unknown): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const parsed = carDeactivationSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
    await assertCarsInScope(staff, [id]);
    const cancelled = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(cars)
        .set({ status: "deactivated", deactivationReason: parsed.data.reason, deactivationNote: parsed.data.note || null, deactivatedAt: new Date(), deactivatedBy: staff.id, updatedBy: staff.id })
        .where(and(eq(cars.id, id), inArray(cars.status, ["active", "maintenance"])))
        .returning({ id: cars.id });
      if (!row) throw Object.assign(new Error("car_frozen"), { code: "P0002" });
      const rows = await tx
        .update(reservations)
        .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: "car_unavailable" })
        .where(and(eq(reservations.carId, id), inArray(reservations.status, ["pending", "confirmed"]), gte(reservations.endDate, sql`CURRENT_DATE`)))
        .returning({ id: reservations.id });
      // La voiture sort des listes de ses gestionnaires ; leurs nombres de voitures sont recalculés.
      await syncCarAssignments(id, tx);
      await tx.insert(auditLogs).values({ actorId: staff.id, entity: "car", entityId: id, action: "deactivate", changes: { ...parsed.data, cancelledReservations: rows.length } });
      return rows.map((r) => r.id);
    });

    for (const rid of cancelled) {
      const r = await db.query.reservations.findFirst({ where: eq(reservations.id, rid), with: { car: true, client: true, pickupAgency: true } });
      if (!r) continue;
      await sendReservationEmail("cancelled", {
        to: r.client.email,
        locale: r.locale,
        reference: r.reference,
        car: `${r.car.brand} ${r.car.model}`,
        start: formatDate(r.startDate, r.locale),
        end: formatDate(r.endDate, r.locale),
        pickup: `${r.pickupAgency.city}, ${r.pickupAgency.name}`,
        total: formatMoney(r.totalPrice, r.locale),
      }).catch((e) => console.error("[email]", e));
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** En réparation ↔ en service. Une voiture en réparation n'est plus proposée à la réservation sur le site. */
export async function setCarMaintenance(id: string, inRepair: boolean): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    await assertCarsInScope(staff, [id]);
    const [row] = await db
      .update(cars)
      .set({ status: inRepair ? "maintenance" : "active", updatedBy: staff.id })
      .where(and(eq(cars.id, id), eq(cars.status, inRepair ? "active" : "maintenance")))
      .returning({ id: cars.id });
    if (!row) return { ok: false, error: "invalid_transition" };
    await db.insert(auditLogs).values({ actorId: staff.id, entity: "car", entityId: id, action: inRepair ? "repair_start" : "repair_end" });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Action groupée du parc : désactiver (motif), remettre en service, mettre en réparation,
 * affecter à des gestionnaires ou rattacher à une agence. Chaque voiture est traitée séparément ;
 * celles où l'action ne s'applique pas sont ignorées.
 */
export async function bulkFleetAction(
  ids: string[],
  action: "deactivate" | "activate" | "repair" | "assign" | "agency" | "promo",
  payload: { reason?: string; note?: string; managerIds?: string[]; agencyId?: number; promo?: unknown } = {},
): Promise<ActionResult<{ done: string[]; skipped: number }>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const list = z.array(z.string().uuid()).min(1).max(300).safeParse(ids);
    if (!list.success) return { ok: false, error: "validation" };
    // Toutes les voitures sélectionnées doivent être dans le périmètre du gestionnaire.
    await assertCarsInScope(staff, list.data);
    if (action === "agency" && typeof payload.agencyId === "number") await assertAgencyInScope(staff, payload.agencyId);
    const done: string[] = [];
    if (action === "promo") {
      // Promotion en % sur les voitures sélectionnées (les voitures désactivées sont figées et ignorées).
      const promo = promoSchema.safeParse(payload.promo ?? null);
      if (!promo.success) return { ok: false, error: "validation" };
      const values = promo.data ?? { percent: null, startsOn: null, endsOn: null };
      const rows = await db
        .update(cars)
        .set({ promoPercent: values.percent, promoStartsOn: values.startsOn, promoEndsOn: values.endsOn, updatedBy: staff.id })
        .where(and(inArray(cars.id, list.data), sql`${cars.status} <> 'deactivated'`))
        .returning({ id: cars.id });
      done.push(...rows.map((r) => r.id));
    } else if (action === "assign" || action === "agency") {
      if (action === "assign" && staff.role !== "admin") return { ok: false, error: "forbidden" };
      const live = await db.select({ id: cars.id }).from(cars).where(and(inArray(cars.id, list.data), sql`${cars.status} <> 'deactivated'`));
      const carIds = live.map((c) => c.id);
      if (action === "assign") {
        const managerIds = z.array(z.string().uuid()).min(1).max(100).safeParse(payload.managerIds);
        if (!managerIds.success) return { ok: false, error: "validation" };
        if (carIds.length)
          await db
            .insert(carManagers)
            .values(carIds.flatMap((carId) => managerIds.data.map((managerId) => ({ carId, managerId, source: "manual" }))))
            .onConflictDoNothing();
        await recountManagers(managerIds.data);
      } else {
        const agencyId = z.number().int().positive().safeParse(payload.agencyId);
        if (!agencyId.success) return { ok: false, error: "validation" };
        // Seules les voitures qui changent vraiment d'agence déclenchent l'email aux gestionnaires de l'agence.
        const moving = carIds.length
          ? (await db.select({ id: cars.id }).from(cars).where(and(inArray(cars.id, carIds), sql`${cars.agencyId} <> ${agencyId.data}`))).map((c) => c.id)
          : [];
        if (carIds.length) await db.update(cars).set({ agencyId: agencyId.data, updatedBy: staff.id }).where(inArray(cars.id, carIds));
        for (const id of carIds) await syncCarAssignments(id);
        await notifyCarsJoinedAgency(moving, agencyId.data, await actorLabel(staff), staff.email).catch((e) => console.error("[email] voitures associées à une agence", e));
      }
      done.push(...carIds);
    } else {
      for (const id of list.data) {
        const r =
          action === "deactivate"
            ? await deactivateCar(id, { reason: payload.reason, note: payload.note })
            : await setCarMaintenance(id, action === "repair");
        if (r.ok) done.push(id);
      }
    }
    await db.insert(auditLogs).values({
      actorId: staff.id,
      entity: "car",
      entityId: "bulk",
      action: `bulk_${action}`,
      changes: { title: String(done.length), done, skipped: list.data.length - done.length, ...payload, ...(action === "promo" ? { note: promoNote(payload.promo) } : {}) },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { done, skipped: list.data.length - done.length } };
  } catch (err) {
    return toActionError(err);
  }
}

/** Promotion d'une voiture : remise en % (1 à 90), dates de début et de fin facultatives ; null = retirer. */
const promoSchema = z
  .object({
    percent: z.coerce.number().int().min(1).max(90),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().transform((v) => v || null),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().transform((v) => v || null),
  })
  .refine((p) => !p.startsOn || !p.endsOn || p.endsOn >= p.startsOn, { message: "dateOrder", path: ["endsOn"] })
  .nullable();

function promoNote(raw: unknown) {
  const p = promoSchema.safeParse(raw ?? null);
  if (!p.success || !p.data) return "—";
  return `-${p.data.percent} %${p.data.startsOn ? ` · ${p.data.startsOn}` : ""}${p.data.endsOn ? ` → ${p.data.endsOn}` : ""}`;
}

/** Onglet « Promotion » de la fiche voiture. */
export async function setCarPromotion(id: string, input: unknown): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const p = promoSchema.safeParse(input ?? null);
    if (!p.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(p.error.issues) };
    const [current] = await db.select({ status: cars.status }).from(cars).where(eq(cars.id, id)).limit(1);
    if (!current) return { ok: false, error: "not_found" };
    if (current.status === "deactivated") return { ok: false, error: "car_frozen" };
    await assertCarsInScope(staff, [id]);
    const v = p.data ?? { percent: null, startsOn: null, endsOn: null };
    await db.update(cars).set({ promoPercent: v.percent, promoStartsOn: v.startsOn, promoEndsOn: v.endsOn, updatedBy: staff.id }).where(eq(cars.id, id));
    await db.insert(auditLogs).values({ actorId: staff.id, entity: "car", entityId: id, action: "promo", changes: { ...v, note: promoNote(input) } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
