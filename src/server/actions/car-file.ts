"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, carInspectionPhotos, carInspections, carRecordFiles, carRecords, cars, carRecordKindEnum, expenseCategoryEnum, reservations } from "@/db/schema";
import { assertCarsInScope } from "@/server/agency-scope";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { documentViewUrl, verifyUpload } from "@/server/uploads";
import { pgArray } from "@/lib/utils";

const fileSchema = z.object({
  publicId: z.string().min(1).max(300),
  name: z.string().trim().min(1).max(200),
  resourceType: z.enum(["image", "raw"]).default("image"),
});

const optionalDate = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date").nullable());
const optionalInt = z.union([z.literal(""), z.null(), z.coerce.number().int().min(0, "number").max(5_000_000, "number")]).transform((v) => (v === "" ? null : v));
const optionalAmount = z.union([z.literal(""), z.null(), z.coerce.number().min(0, "number").max(10_000_000, "number")]).transform((v) => (v === "" ? null : v));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "maxLength")
    .transform((v) => v || null);

const recordSchema = z
  .object({
    kind: z.enum(carRecordKindEnum.enumValues),
    category: z.enum(expenseCategoryEnum.enumValues).nullable().default(null),
    performedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "required"),
    validUntil: optionalDate,
    mileage: optionalInt,
    nextMileage: optionalInt,
    amount: optionalAmount,
    provider: optionalText(160),
    reference: optionalText(120),
    notes: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.validUntil && v.validUntil < v.performedOn) ctx.addIssue({ code: "custom", path: ["validUntil"], message: "dateOrder" });
    // Assurance, vignette et visite technique ont une échéance ; une dépense a une catégorie.
    if (["insurance", "vignette", "technical_inspection"].includes(v.kind) && !v.validUntil) ctx.addIssue({ code: "custom", path: ["validUntil"], message: "required" });
    if (v.kind === "expense" && !v.category) ctx.addIssue({ code: "custom", path: ["category"], message: "required" });
  });

function fieldErrors(issues: z.core.$ZodIssue[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

async function attach(recordId: string, files: unknown, userId: string) {
  const list = z.array(fileSchema).max(10).parse(files ?? []);
  for (const f of list) {
    const v = await verifyUpload(f.publicId, "document", f.resourceType);
    await db.insert(carRecordFiles).values({ recordId, name: f.name, publicId: v.publicId, resourceType: f.resourceType, format: v.format, bytes: v.bytes, createdBy: userId });
  }
}

/** Ajoute une ligne au dossier d'une voiture (assurance, vignette, vidange, visite technique, dépense) avec ses documents. */
export async function addCarRecord(carId: string, input: unknown, files?: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    await assertCarsInScope(staff, [carId]);
    const p = recordSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(p.error.issues) };
    const [car] = await db.select({ status: cars.status, mileage: cars.mileage }).from(cars).where(eq(cars.id, carId)).limit(1);
    if (!car) return { ok: false, error: "not_found" };
    if (car.status === "deactivated") return { ok: false, error: "car_frozen" };
    const { kind, category, ...rest } = p.data;
    const [row] = await db
      .insert(carRecords)
      .values({ carId, kind, category: kind === "expense" ? category : null, ...rest, createdBy: staff.id, updatedBy: staff.id })
      .returning({ id: carRecords.id });
    await attach(row.id, files, staff.id);
    // Un kilométrage relevé plus élevé met à jour celui de la voiture.
    if (rest.mileage && rest.mileage > car.mileage) await db.update(cars).set({ mileage: rest.mileage, updatedBy: staff.id }).where(eq(cars.id, carId));
    await db.insert(auditLogs).values({ actorId: staff.id, entity: "car", entityId: carId, action: `record_${kind}`.slice(0, 32), changes: { recordId: row.id, ...p.data } });
    revalidatePath("/", "layout");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateCarRecord(id: string, input: unknown, files?: unknown): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const [cur] = await db.select({ carId: carRecords.carId, kind: carRecords.kind, voidedAt: carRecords.voidedAt }).from(carRecords).where(eq(carRecords.id, id)).limit(1);
    if (!cur) return { ok: false, error: "not_found" };
    await assertCarsInScope(staff, [cur.carId]);
    if (cur.voidedAt) return { ok: false, error: "invalid_transition" };
    const p = recordSchema.safeParse({ ...(input as object), kind: cur.kind });
    if (!p.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(p.error.issues) };
    const { kind, category, ...rest } = p.data;
    await db.update(carRecords).set({ ...rest, category: kind === "expense" ? category : null, updatedBy: staff.id, updatedAt: new Date() }).where(eq(carRecords.id, id));
    await attach(id, files, staff.id);
    await db.insert(auditLogs).values({ actorId: staff.id, entity: "car", entityId: cur.carId, action: "record_update", changes: { recordId: id, ...p.data } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Annule une saisie erronée : elle reste visible, barrée, et sort des échéances et des calculs. */
export async function voidCarRecord(id: string): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const [cur] = await db.select({ carId: carRecords.carId }).from(carRecords).where(eq(carRecords.id, id)).limit(1);
    if (!cur) return { ok: false, error: "not_found" };
    await assertCarsInScope(staff, [cur.carId]);
    await db.update(carRecords).set({ voidedAt: new Date(), updatedBy: staff.id }).where(and(eq(carRecords.id, id), sql`${carRecords.voidedAt} IS NULL`));
    await db.insert(auditLogs).values({ actorId: staff.id, entity: "car", entityId: cur.carId, action: "record_void", changes: { recordId: id } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Lien temporaire (10 min) vers un document privé du dossier. */
export async function carRecordFileUrl(fileId: number): Promise<ActionResult<{ url: string }>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const [f] = await db
      .select({ publicId: carRecordFiles.publicId, resourceType: carRecordFiles.resourceType, format: carRecordFiles.format, carId: carRecords.carId })
      .from(carRecordFiles)
      .innerJoin(carRecords, eq(carRecords.id, carRecordFiles.recordId))
      .where(eq(carRecordFiles.id, fileId))
      .limit(1);
    if (!f) return { ok: false, error: "not_found" };
    await assertCarsInScope(staff, [f.carId]);
    const url = documentViewUrl(f.publicId, f.resourceType, f.format);
    if (!url) return { ok: false, error: "cloudinary_not_configured" };
    return { ok: true, data: { url } };
  } catch (err) {
    return toActionError(err);
  }
}

/* ───────────────────────── États des lieux ───────────────────────── */

const inspectionSchema = z.object({
  kind: z.enum(["departure", "return"]),
  reservationId: z.string().uuid().nullable().default(null),
  mileage: z.coerce.number().int().min(0, "number").max(5_000_000, "number"),
  fuelEighths: z.coerce.number().int().min(0).max(8),
  damages: optionalText(4000),
  notes: optionalText(4000),
  signedByName: optionalText(160),
});

/**
 * Enregistre un état des lieux (départ ou retour) : kilométrage, carburant, dégâts, photos et signature du client.
 * Le kilométrage de la voiture est mis à jour s'il augmente.
 */
export async function addInspection(
  carId: string,
  input: unknown,
  photos: unknown,
  signature: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    await assertCarsInScope(staff, [carId]);
    const p = inspectionSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(p.error.issues) };
    const [car] = await db.select({ status: cars.status, mileage: cars.mileage }).from(cars).where(eq(cars.id, carId)).limit(1);
    if (!car) return { ok: false, error: "not_found" };
    if (car.status === "deactivated") return { ok: false, error: "car_frozen" };
    if (p.data.reservationId) {
      const [r] = await db.select({ carId: reservations.carId }).from(reservations).where(eq(reservations.id, p.data.reservationId)).limit(1);
      if (!r || r.carId !== carId) return { ok: false, error: "validation" };
    }
    const photoList = z.array(fileSchema).max(20).parse(photos ?? []);
    const sig = signature ? fileSchema.parse(signature) : null;
    const sigFile = sig ? await verifyUpload(sig.publicId, "document", "image") : null;
    const verified: (z.infer<typeof fileSchema> & { v: Awaited<ReturnType<typeof verifyUpload>> })[] = [];
    for (const ph of photoList) verified.push({ ...ph, v: await verifyUpload(ph.publicId, "document", ph.resourceType) });

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(carInspections)
        .values({ carId, ...p.data, signaturePublicId: sigFile?.publicId ?? null, createdBy: staff.id })
        .returning({ id: carInspections.id });
      if (verified.length)
        await tx.insert(carInspectionPhotos).values(verified.map((ph) => ({ inspectionId: row.id, publicId: ph.v.publicId, resourceType: ph.resourceType, format: ph.v.format, caption: ph.name })));
      if (p.data.mileage > car.mileage) await tx.update(cars).set({ mileage: p.data.mileage, updatedBy: staff.id }).where(eq(cars.id, carId));
      await tx.insert(auditLogs).values({ actorId: staff.id, entity: "car", entityId: carId, action: `inspection_${p.data.kind}`, changes: { inspectionId: row.id, ...p.data } });
      return row.id;
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  } catch (err) {
    return toActionError(err);
  }
}

/** Liens temporaires vers les photos et la signature d'un état des lieux. */
export async function inspectionMedia(id: string): Promise<ActionResult<{ photos: { url: string; caption: string | null }[]; signature: string | null }>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const [ins] = await db.select({ carId: carInspections.carId, sig: carInspections.signaturePublicId }).from(carInspections).where(eq(carInspections.id, id)).limit(1);
    if (!ins) return { ok: false, error: "not_found" };
    await assertCarsInScope(staff, [ins.carId]);
    const photos = await db.select().from(carInspectionPhotos).where(eq(carInspectionPhotos.inspectionId, id));
    return {
      ok: true,
      data: {
        photos: photos.map((ph) => ({ url: documentViewUrl(ph.publicId, ph.resourceType, ph.format) ?? "", caption: ph.caption })).filter((x) => x.url),
        signature: ins.sig ? documentViewUrl(ins.sig, "image", "png") : null,
      },
    };
  } catch (err) {
    return toActionError(err);
  }
}

/* ───────────────────────── Planning ───────────────────────── */

/** Réservations d'une période pour le planning (une voiture ou tout le parc du périmètre). */
export async function loadCalendar(from: string, to: string, carId?: string): Promise<ActionResult<import("@/server/queries/car-file").CalendarBooking[]>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    if (!d.safeParse(from).success || !d.safeParse(to).success) return { ok: false, error: "validation" };
    const { calendarBookings } = await import("@/server/queries/car-file");
    if (carId) {
      await assertCarsInScope(staff, [carId]);
      return { ok: true, data: await calendarBookings(from, to, [carId]) };
    }
    const { agencyScope } = await import("@/server/agency-scope");
    const scope = await agencyScope(staff);
    if (!scope) return { ok: true, data: await calendarBookings(from, to) };
    const ids = await db.execute<{ id: string }>(sql`
      SELECT c.id FROM cars c WHERE c.agency_id = ANY(${pgArray(scope)}::int[])
         OR EXISTS (SELECT 1 FROM car_agencies ca WHERE ca.car_id = c.id AND ca.agency_id = ANY(${pgArray(scope)}::int[]))`);
    return { ok: true, data: await calendarBookings(from, to, ids.rows.map((r) => r.id)) };
  } catch (err) {
    return toActionError(err);
  }
}
