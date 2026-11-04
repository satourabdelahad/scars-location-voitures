"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db } from "@/db";
import { agencies, auditLogs, cars, extras, reservationExtras, reservations, users, type ReservationStatus } from "@/db/schema";
import { reservationSchema } from "@/lib/validation";
import { formatDate, formatMoney, rentalDays, todayISO } from "@/lib/utils";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { sendReservationEmail } from "@/server/email";
import { isLocale } from "@/i18n/config";
import { computeDiscount, findApplicablePromotion, promotionLabel } from "@/server/promotions";

function fieldErrors(issues: z.core.$ZodIssue[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Envoie l'email de suivi dans la langue choisie par le client lors de sa réservation. */
async function notify(reservationId: string, kind: "received" | "confirmed" | "rejected" | "cancelled", reason?: string | null) {
  const r = await db.query.reservations.findFirst({
    where: eq(reservations.id, reservationId),
    with: { car: true, client: true, pickupAgency: true },
  });
  if (!r) return;
  await sendReservationEmail(kind, {
    to: r.client.email,
    locale: r.locale,
    reference: r.reference,
    car: `${r.car.brand} ${r.car.model}`,
    start: formatDate(r.startDate, r.locale),
    end: formatDate(r.endDate, r.locale),
    pickup: `${r.pickupAgency.city}, ${r.pickupAgency.name}`,
    total: formatMoney(r.totalPrice, r.locale),
    reason,
  }).catch((e) => console.error("[email]", e));
}

/* ───────────────────────── Côté client ───────────────────────── */

export async function createReservation(input: unknown): Promise<ActionResult<{ reference: string }>> {
  try {
    const user = await assertRole(["client"]);
    const locale = await getLocale();
    const parsed = reservationSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
    const r = parsed.data;
    if (r.startDate < todayISO()) return { ok: false, error: "validation", fieldErrors: { startDate: "pastDate" } };

    const [car] = await db.select().from(cars).where(and(eq(cars.id, r.carId), eq(cars.status, "active"))).limit(1);
    if (!car) return { ok: false, error: "car_unavailable" };
    const agencyRows = await db
      .select({ id: agencies.id })
      .from(agencies)
      .where(and(inArray(agencies.id, [r.pickupAgencyId, r.returnAgencyId]), eq(agencies.isActive, true)));
    if (agencyRows.length !== new Set([r.pickupAgencyId, r.returnAgencyId]).size) return { ok: false, error: "validation" };

    // Le prix est toujours recalculé côté serveur à partir des tarifs en base.
    const days = rentalDays(r.startDate, r.endDate);
    const chosen = r.extras.length
      ? await db.select().from(extras).where(and(inArray(extras.id, r.extras), eq(extras.isActive, true)))
      : [];
    const extrasTotal = chosen.reduce((s, x) => s + x.pricePerDay * days, 0);
    const subtotal = car.dailyPrice * days + extrasTotal;
    const promo = r.promoCode ? await findApplicablePromotion(r.promoCode, r.startDate, days) : null;
    if (r.promoCode && !promo) return { ok: false, error: "promo_invalid", fieldErrors: { promoCode: "promo_invalid" } };
    const discount = promo ? computeDiscount(promo, subtotal) : 0;
    const total = subtotal - discount;

    const created = await db.transaction(async (tx) => {
      const [{ seq }] = (
        await tx.execute<{ seq: string }>(sql`SELECT nextval('reservation_ref_seq')::text AS seq`)
      ).rows;
      const reference = `SCR-${r.startDate.slice(0, 4)}-${seq.padStart(6, "0")}`;
      const [row] = await tx
        .insert(reservations)
        .values({
          reference,
          carId: car.id,
          clientId: user.id,
          pickupAgencyId: r.pickupAgencyId,
          returnAgencyId: r.returnAgencyId,
          startDate: r.startDate,
          endDate: r.endDate,
          days,
          dailyPrice: car.dailyPrice,
          extrasTotal,
          promotionId: promo?.id ?? null,
          discountAmount: discount,
          totalPrice: total,
          deposit: car.deposit,
          driverFirstName: r.driverFirstName,
          driverLastName: r.driverLastName,
          driverPhone: r.driverPhone,
          driverLicenseNumber: r.driverLicenseNumber,
          driverBirthDate: r.driverBirthDate,
          flightNumber: r.flightNumber || null,
          clientNote: r.clientNote || null,
          locale: isLocale(locale) ? locale : "fr",
        })
        .returning({ id: reservations.id, reference: reservations.reference });
      if (chosen.length)
        await tx.insert(reservationExtras).values(chosen.map((x) => ({ reservationId: row.id, extraId: x.id, unitPricePerDay: x.pricePerDay })));
      await tx.update(users).set({ phone: r.driverPhone }).where(and(eq(users.id, user.id), sql`${users.phone} IS NULL`));
      return row;
    });

    await notify(created.id, "received");
    revalidatePath(`/${locale}/account`);
    return { ok: true, data: { reference: created.reference } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelOwnReservation(id: string, reason?: string): Promise<ActionResult> {
  try {
    const user = await assertRole(["client"]);
    const [row] = await db
      .update(reservations)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason?.trim() || null })
      .where(and(eq(reservations.id, id), eq(reservations.clientId, user.id), inArray(reservations.status, ["pending", "confirmed"])))
      .returning({ id: reservations.id });
    if (!row) return { ok: false, error: "invalid_transition" };
    await notify(row.id, "cancelled", reason);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/* ─────────────────────── Côté gestionnaire / admin ─────────────────────── */

const TRANSITIONS: Record<string, { from: ReservationStatus[]; to: ReservationStatus }> = {
  confirm: { from: ["pending"], to: "confirmed" },
  reject: { from: ["pending"], to: "rejected" },
  pickup: { from: ["confirmed"], to: "ongoing" },
  return: { from: ["ongoing"], to: "completed" },
  cancel: { from: ["pending", "confirmed"], to: "cancelled" },
};

export async function transitionReservation(
  id: string,
  action: keyof typeof TRANSITIONS,
  opts: { reason?: string; internalNote?: string } = {},
): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const tr = TRANSITIONS[action];
    if (!tr) return { ok: false, error: "validation" };
    const now = new Date();
    const patch: Partial<typeof reservations.$inferInsert> = { status: tr.to };
    if (action === "confirm") Object.assign(patch, { confirmedAt: now, handledBy: staff.id });
    if (action === "reject") Object.assign(patch, { handledBy: staff.id, cancelReason: opts.reason?.trim() || null, cancelledAt: now });
    if (action === "pickup") Object.assign(patch, { pickedUpAt: now });
    if (action === "return") Object.assign(patch, { returnedAt: now });
    if (action === "cancel") Object.assign(patch, { cancelledAt: now, cancelReason: opts.reason?.trim() || null });
    if (opts.internalNote !== undefined) patch.internalNote = opts.internalNote.trim() || null;

    // Le "WHERE status IN (...)" rend la transition atomique : deux gestionnaires ne peuvent pas confirmer en même temps.
    const [row] = await db
      .update(reservations)
      .set(patch)
      .where(and(eq(reservations.id, id), inArray(reservations.status, tr.from)))
      .returning({ id: reservations.id });
    if (!row) return { ok: false, error: "invalid_transition" };

    await db.insert(auditLogs).values({ actorId: staff.id, entity: "reservation", entityId: id, action, changes: opts });
    if (action === "confirm") await notify(id, "confirmed");
    if (action === "reject") await notify(id, "rejected", opts.reason);
    if (action === "cancel") await notify(id, "cancelled", opts.reason);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function saveInternalNote(id: string, note: string): Promise<ActionResult> {
  try {
    await assertRole(["admin", "manager"]);
    await db.update(reservations).set({ internalNote: note.trim() || null }).where(eq(reservations.id, id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Vérifie un code promo pour l'aperçu du prix (le montant final est toujours recalculé à la réservation). */
export async function checkPromoCode(input: { code: string; carId: string; startDate: string; endDate: string; extras: number[] }) {
  const days = rentalDays(input.startDate, input.endDate);
  if (!input.code.trim() || days < 1) return { ok: false as const };
  const [car] = await db.select({ dailyPrice: cars.dailyPrice }).from(cars).where(and(eq(cars.id, input.carId), eq(cars.status, "active"))).limit(1);
  if (!car) return { ok: false as const };
  const promo = await findApplicablePromotion(input.code, input.startDate, days);
  if (!promo) return { ok: false as const };
  const ids = input.extras.filter((n) => Number.isInteger(n)).slice(0, 10);
  const chosen = ids.length ? await db.select().from(extras).where(and(inArray(extras.id, ids), eq(extras.isActive, true))) : [];
  const subtotal = car.dailyPrice * days + chosen.reduce((s, x) => s + x.pricePerDay * days, 0);
  return { ok: true as const, code: promo.code, label: promotionLabel(promo), discount: computeDiscount(promo, subtotal) };
}
