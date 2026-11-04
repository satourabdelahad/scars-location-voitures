"use server";

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, carImages, carManagers, carTranslations, cars, reservations } from "@/db/schema";
import { notifyCarCreated } from "@/server/notifications";
import { carDeactivationSchema, carSchema, LOCALE_CODES } from "@/lib/validation";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { verifyUpload } from "@/server/uploads";
import { sendReservationEmail } from "@/server/email";
import { formatDate, formatMoney } from "@/lib/utils";

const imagesSchema = z
  .array(z.object({ publicId: z.string().min(3).max(300), url: z.string().max(600), width: z.number().nullable().optional(), height: z.number().nullable().optional() }))
  .max(12);

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
      if (k.position !== position) await tx.update(carImages).set({ position }).where(eq(carImages.id, k.id));
    } else {
      const v = await verifyUpload(img.publicId, "car");
      await tx.insert(carImages).values({ carId, publicId: v.publicId, url: v.url, width: v.width, height: v.height, position });
    }
  }
}

const managerIdsSchema = z.array(z.string().uuid()).max(100).default([]);

/** Gestionnaires associés : on remplace la liste (vide = tous les gestionnaires). */
async function writeManagers(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], carId: string, ids: string[]) {
  await tx.delete(carManagers).where(eq(carManagers.carId, carId));
  if (ids.length) await tx.insert(carManagers).values([...new Set(ids)].map((managerId) => ({ carId, managerId })));
}

export async function createCar(input: { data: unknown; images: unknown; managerIds?: unknown }): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const parsed = carSchema.safeParse(input.data);
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
    const images = imagesSchema.parse(input.images ?? []);
    const managerIds = managerIdsSchema.parse(input.managerIds ?? []);
    const { descriptions, ...data } = parsed.data;
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(cars)
        .values({ ...data, vin: data.vin || null, createdBy: staff.id, updatedBy: staff.id })
        .returning({ id: cars.id });
      await writeChildren(tx, row.id, descriptions, images);
      await writeManagers(tx, row.id, managerIds);
      await tx.insert(auditLogs).values({ actorId: staff.id, entity: "car", entityId: row.id, action: "create", changes: { ...data, managerIds } });
      return row.id;
    });
    await notifyCarCreated(id, staff.name ?? staff.email ?? "—").catch((e) => console.error("[email] nouvelle voiture", e));
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
    const managerIds = managerIdsSchema.parse(input.managerIds ?? []);
    const { descriptions, ...data } = parsed.data;
    const [current] = await db.select({ status: cars.status }).from(cars).where(eq(cars.id, id)).limit(1);
    if (!current) return { ok: false, error: "not_found" };
    // Contrôle applicatif ; la base le garantit aussi par un trigger.
    if (current.status === "deactivated") return { ok: false, error: "car_frozen" };
    await db.transaction(async (tx) => {
      await tx.update(cars).set({ ...data, vin: data.vin || null, updatedBy: staff.id }).where(eq(cars.id, id));
      await writeChildren(tx, id, descriptions, images);
      await writeManagers(tx, id, managerIds);
      await tx.insert(auditLogs).values({ actorId: staff.id, entity: "car", entityId: id, action: "update", changes: { ...data, managerIds } });
    });
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
