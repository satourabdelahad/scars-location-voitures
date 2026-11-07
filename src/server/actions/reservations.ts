"use server";

import { verifyRecaptcha } from "@/server/recaptcha";
import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db } from "@/db";
import { agencies, auditLogs, cars, clientProfiles, clientPromotions, extras, reservationExtensions, reservationExtras, reservations, users, type ReservationStatus } from "@/db/schema";
import { bookingProfileSchema, guestClientSchema, reservationSchema } from "@/lib/validation";
import { auth, signIn } from "@/auth";
import { mintBookingToken } from "@/server/booking-token";
import { getBookingSettings } from "@/server/app-settings";
import { extrasCost } from "@/lib/pricing";
import { issuePasswordToken } from "@/server/tokens";
import { canValidateReservation } from "@/server/queries/reservations";
import { formatDate, formatMoney, rentalDays, todayISO } from "@/lib/utils";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { assertReservationInScope } from "@/server/agency-scope";
import { sendReservationEmail } from "@/server/email";
import { notifyClientInvite, notifyExtensionDecision, notifyExtensionRequest, notifyReservationCreated } from "@/server/notifications";
import { isLocale } from "@/i18n/config";
import { computeDiscount, findApplicablePromotion, promotionLabel } from "@/server/promotions";
import { activePromoPercent, promoPrice } from "@/lib/car-promo";

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

/**
 * Client sans compte : on retrouve sa fiche (même email ou même téléphone, compte sans mot de passe
 * ni connexion sociale) ou on la crée avec le minimum demandé. Un compte protégé par un mot de passe
 * ou une connexion sociale demande de se connecter d'abord.
 */
async function guestClient(input: unknown, locale: string): Promise<{ ok: true; id: string; created: boolean; email: string | null } | { ok: false; error: string; fieldErrors?: Record<string, string> }> {
  const parsed = guestClientSchema.safeParse(input);
  if (!parsed.success) {
    const fe = fieldErrors(parsed.error.issues);
    return { ok: false, error: "validation", fieldErrors: Object.fromEntries(Object.entries(fe).map(([k, v]) => [`guest.${k}`, v])) };
  }
  const g = parsed.data;
  const protectedAccount = (id: string) =>
    db.execute<{ n: number }>(sql`SELECT (SELECT count(*)::int FROM accounts a WHERE a.user_id = ${id}) AS n`).then((r) => (r.rows[0]?.n ?? 0) > 0);
  const findBy = async (where: SQL) => (await db.select({ id: users.id, role: users.role, status: users.status, passwordHash: users.passwordHash, email: users.email }).from(users).where(where).limit(1))[0];
  const existing = g.email ? await findBy(eq(users.email, g.email)) : await findBy(and(eq(users.phone, g.phone), eq(users.role, "client"))!);
  if (existing) {
    if (existing.role !== "client" || existing.status !== "active" || existing.passwordHash || (await protectedAccount(existing.id)))
      return { ok: false, error: "account_exists" };
    // Fiche existante : elle n'est pas modifiée (le conducteur saisi figure sur la réservation).
    await db.insert(clientProfiles).values({ userId: existing.id, civility: g.civility, firstName: g.firstName, lastName: g.lastName, city: g.city, whatsapp: g.whatsapp }).onConflictDoNothing();
    return { ok: true, id: existing.id, created: false, email: existing.email };
  }
  const id = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ role: "client", name: `${g.firstName} ${g.lastName}`, email: g.email, phone: g.phone, preferredLocale: isLocale(locale) ? locale : "fr" })
      .returning({ id: users.id });
    await tx.insert(clientProfiles).values({ userId: u.id, civility: g.civility, firstName: g.firstName, lastName: g.lastName, city: g.city, whatsapp: g.whatsapp });
    await tx.insert(auditLogs).values({ actorId: u.id, entity: "client", entityId: u.id, action: "create", changes: { source: "booking", city: g.city } });
    return u.id;
  });
  return { ok: true, id, created: true, email: g.email };
}

export async function createReservation(
  input: unknown,
  recaptcha?: string,
  guest?: unknown,
  /** Client connecté : informations complétées (numéro de carte d'identité, permis…) */
  profile?: unknown,
): Promise<ActionResult<{ id: string; reference: string; guest: boolean; invited: boolean; signedIn: boolean; responseHours: number }>> {
  try {
    const session = await auth();
    const signedIn = session?.user?.role === "client" ? session.user : null;
    // L'équipe ne réserve pas depuis le site public avec son compte.
    if (session?.user && !signedIn) return { ok: false, error: "forbidden" };
    if (!signedIn && !guest) return { ok: false, error: "unauthenticated" };
    if (!(await verifyRecaptcha(recaptcha, "booking"))) return { ok: false, error: "captcha" };
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

    // Client connecté : il complète ses informations (après une connexion sociale notamment).
    let prof: z.infer<typeof bookingProfileSchema> | null = null;
    if (signedIn && profile) {
      const pp = bookingProfileSchema.safeParse(profile);
      if (!pp.success) return { ok: false, error: "validation", fieldErrors: Object.fromEntries(Object.entries(fieldErrors(pp.error.issues)).map(([k, v]) => [`profile.${k}`, v])) };
      prof = pp.data;
    }
    // Identification : client connecté, ou nouveau client (fiche créée ou retrouvée).
    let clientId: string;
    let created = false;
    let guestEmail: string | null = null;
    if (signedIn) clientId = signedIn.id;
    else {
      const g = await guestClient(guest, locale);
      if (!g.ok) return { ok: false, error: g.error, fieldErrors: g.fieldErrors };
      clientId = g.id;
      created = g.created;
      guestEmail = g.email;
    }
    // Liste noire : le client ne peut plus réserver.
    if (await isBlacklisted(clientId)) return { ok: false, error: "client_blacklisted" };

    // Le prix est toujours recalculé côté serveur à partir des tarifs en base.
    const days = rentalDays(r.startDate, r.endDate);
    // Promotion de la voiture (en %) en cours au premier jour de la location.
    const carPromo = activePromoPercent(car, r.startDate);
    const dailyPrice = promoPrice(car.dailyPrice, carPromo);
    const chosen = r.extras.length
      ? await db.select().from(extras).where(and(inArray(extras.id, r.extras), eq(extras.isActive, true)))
      : [];
    const extrasTotal = extrasCost(chosen.map((x) => ({ price: x.pricePerDay, pricing: x.pricing })), days);
    const bookingCfg = await getBookingSettings();
    const driverTotal = r.withDriver ? bookingCfg.driverPricePerDay * days : 0;
    const subtotal = dailyPrice * days + extrasTotal + driverTotal;
    const promo = r.promoCode ? await findApplicablePromotion(r.promoCode, r.startDate, days, clientId) : null;
    if (r.promoCode && !promo) return { ok: false, error: "promo_invalid", fieldErrors: { promoCode: "promo_invalid" } };
    const discount = promo ? computeDiscount(promo, subtotal) : 0;
    const total = subtotal - discount;

    const createdRow = await db.transaction(async (tx) => {
      const [{ seq }] = (
        await tx.execute<{ seq: string }>(sql`SELECT nextval('reservation_ref_seq')::text AS seq`)
      ).rows;
      const reference = `SCR-${r.startDate.slice(0, 4)}-${seq.padStart(6, "0")}`;
      const [row] = await tx
        .insert(reservations)
        .values({
          reference,
          carId: car.id,
          clientId,
          pickupAgencyId: r.pickupAgencyId,
          returnAgencyId: r.returnAgencyId,
          startDate: r.startDate,
          endDate: r.endDate,
          days,
          dailyPrice,
          carPromoPercent: carPromo,
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
          pickupTime: r.pickupTime,
          returnTime: r.returnTime,
          withDriver: r.withDriver,
          driverTotal,
          locale: isLocale(locale) ? locale : "fr",
        })
        .returning({ id: reservations.id, reference: reservations.reference });
      if (chosen.length)
        await tx.insert(reservationExtras).values(chosen.map((x) => ({ reservationId: row.id, extraId: x.id, unitPricePerDay: x.pricePerDay, pricing: x.pricing })));
      await tx.update(users).set({ phone: r.driverPhone }).where(and(eq(users.id, clientId), sql`${users.phone} IS NULL`));
      // Conditions acceptées : inscription à la newsletter (mentionnée dans les conditions de location).
      await tx.update(clientProfiles).set({ newsletterAt: new Date() }).where(and(eq(clientProfiles.userId, clientId), isNull(clientProfiles.newsletterAt)));
      if (prof) {
        await tx
          .insert(clientProfiles)
          .values({ userId: clientId, ...prof })
          .onConflictDoUpdate({ target: clientProfiles.userId, set: { ...prof, updatedAt: new Date() } });
        await tx.update(users).set({ phone: prof.phone, name: `${prof.firstName} ${prof.lastName}` }).where(eq(users.id, clientId));
      }
      // Code attribué par une campagne : il est consommé par cette réservation.
      if (promo?.restricted)
        await tx
          .update(clientPromotions)
          .set({ usedAt: new Date(), reservationId: row.id })
          .where(and(eq(clientPromotions.clientId, clientId), eq(clientPromotions.promotionId, promo.id), isNull(clientPromotions.usedAt)));
      return row;
    });

    // Modèle "Réservation" (Administration) : client, administrateur et gestionnaires de la voiture.
    await notifyReservationCreated(createdRow.id).catch((e) => console.error("[email] réservation", e));
    // Nouveau client avec un email : lien pour choisir son mot de passe et suivre sa réservation.
    let invited = false;
    if (created && guestEmail) {
      const token = await issuePasswordToken(clientId, "invite");
      const res = await notifyClientInvite(clientId, token, "Dizy Cars").catch((e) => {
        console.error("[email] invitation client", e);
        return null;
      });
      invited = Boolean(res?.sent);
    }
    // Nouvelle fiche créée à l'instant : le client est connecté pour suivre sa réservation.
    let nowSignedIn = Boolean(signedIn);
    if (created) {
      try {
        await signIn("booking-token", { token: mintBookingToken(clientId), redirect: false });
        nowSignedIn = true;
      } catch (e) {
        console.error("[auth] connexion après réservation", e);
      }
    }
    revalidatePath(`/${locale}/account`);
    return { ok: true, data: { id: createdRow.id, reference: createdRow.reference, guest: !signedIn, invited, signedIn: nowSignedIn, responseHours: bookingCfg.responseHours } };
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

async function isBlacklisted(clientId: string) {
  const [p] = await db.select({ at: clientProfiles.blacklistedAt }).from(clientProfiles).where(eq(clientProfiles.userId, clientId)).limit(1);
  return Boolean(p?.at);
}

const licenseSchema = z.object({
  number: z.string().trim().min(3, "required").max(64),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "required"),
  checked: z.literal(true),
});

export async function transitionReservation(
  id: string,
  action: keyof typeof TRANSITIONS,
  opts: { reason?: string; internalNote?: string; license?: unknown } = {},
): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const tr = TRANSITIONS[action];
    if (!tr) return { ok: false, error: "validation" };
    // Gestionnaire rattaché à des agences : seulement les réservations des voitures de son périmètre.
    await assertReservationInScope(staff, id);
    // Valider (confirmer ou refuser) : l'administrateur ou le responsable de l'agence de départ.
    if ((action === "confirm" || action === "reject") && !(await canValidateReservation(staff, id))) return { ok: false, error: "validation_reserved" };
    const now = new Date();
    const patch: Partial<typeof reservations.$inferInsert> = { status: tr.to };
    const [cur] = await db.select({ clientId: reservations.clientId, endDate: reservations.endDate }).from(reservations).where(eq(reservations.id, id)).limit(1);
    if (!cur) return { ok: false, error: "not_found" };
    // Client sur liste noire : pas de confirmation ni de remise des clés.
    if ((action === "confirm" || action === "pickup") && (await isBlacklisted(cur.clientId))) return { ok: false, error: "client_blacklisted" };
    // Remise des clés : le permis doit avoir été vérifié, et rester valable jusqu'au retour.
    if (action === "pickup") {
      const lic = licenseSchema.safeParse(opts.license);
      if (!lic.success) return { ok: false, error: "license_required" };
      if (lic.data.expiresOn < cur.endDate) return { ok: false, error: "license_expired" };
      Object.assign(patch, { licenseCheckedAt: now, licenseCheckedBy: staff.id, driverLicenseNumber: lic.data.number, driverLicenseExpiresOn: lic.data.expiresOn });
      await db
        .update(clientProfiles)
        .set({ licenseNumber: lic.data.number, licenseExpiresOn: lic.data.expiresOn })
        .where(eq(clientProfiles.userId, cur.clientId));
    }
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

    await db.insert(auditLogs).values({ actorId: staff.id, entity: "reservation", entityId: id, action, changes: { reason: opts.reason, internalNote: opts.internalNote, license: action === "pickup" ? opts.license : undefined } });
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
export async function checkPromoCode(input: { code: string; carId: string; startDate: string; endDate: string; extras: number[]; withDriver?: boolean }) {
  const days = rentalDays(input.startDate, input.endDate);
  if (!input.code.trim() || days < 1) return { ok: false as const };
  const [car] = await db
    .select({ dailyPrice: cars.dailyPrice, promoPercent: cars.promoPercent, promoStartsOn: cars.promoStartsOn, promoEndsOn: cars.promoEndsOn })
    .from(cars)
    .where(and(eq(cars.id, input.carId), eq(cars.status, "active")))
    .limit(1);
  if (!car) return { ok: false as const };
  // Aperçu : un code réservé est vérifié pour le client connecté ; avant identification, il l'est à la réservation.
  const session = await auth();
  const clientId = session?.user?.role === "client" ? session.user.id : null;
  const promo = await findApplicablePromotion(input.code, input.startDate, days, clientId, { trustRestricted: !clientId });
  if (!promo) return { ok: false as const };
  const ids = input.extras.filter((n) => Number.isInteger(n)).slice(0, 10);
  const chosen = ids.length ? await db.select().from(extras).where(and(inArray(extras.id, ids), eq(extras.isActive, true))) : [];
  const driver = input.withDriver ? (await getBookingSettings()).driverPricePerDay * days : 0;
  const subtotal = promoPrice(car.dailyPrice, activePromoPercent(car, input.startDate)) * days + extrasCost(chosen.map((x) => ({ price: x.pricePerDay, pricing: x.pricing })), days) + driver;
  return { ok: true as const, code: promo.code, label: promotionLabel(promo), discount: computeDiscount(promo, subtotal) };
}

/**
 * Prolongation d'une location confirmée ou en cours : nouvelle date de retour, prix recalculé avec le même
 * prix par jour et les mêmes options. La base refuse si la voiture est déjà réservée sur les nouveaux jours.
 */
/** Prolonge une location (nouvelle date de retour, prix recalculé). La base refuse si les jours ajoutés sont déjà réservés. */
async function applyExtension(id: string, newEndDate: string, actorId: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newEndDate)) return { ok: false as const, error: "validation", fieldErrors: { endDate: "date" } };
    const [r] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
    if (!r) return { ok: false as const, error: "not_found" };
    if (!["confirmed", "ongoing"].includes(r.status)) return { ok: false as const, error: "invalid_transition" };
    if (newEndDate <= r.endDate) return { ok: false as const, error: "validation", fieldErrors: { endDate: "dateOrder" } };
    const days = rentalDays(r.startDate, newEndDate);
    const added = days - r.days;
    const ex = await db.select({ unit: reservationExtras.unitPricePerDay, qty: reservationExtras.quantity, pricing: reservationExtras.pricing }).from(reservationExtras).where(eq(reservationExtras.reservationId, id));
    // Suppléments « une fois » : déjà comptés ; ceux par jour et le chauffeur s'ajoutent pour les jours en plus.
    const extrasPerDay = ex.filter((x) => x.pricing === "per_day").reduce((sum, x) => sum + x.unit * x.qty, 0);
    const driverPerDay = r.withDriver && r.days > 0 ? r.driverTotal / r.days : 0;
    const extrasTotal = r.extrasTotal + extrasPerDay * added;
    const driverTotal = r.driverTotal + driverPerDay * added;
    const total = r.totalPrice + (r.dailyPrice + extrasPerDay + driverPerDay) * added;
    await db
      .update(reservations)
      .set({ endDate: newEndDate, days, extrasTotal, driverTotal, totalPrice: total, originalEndDate: r.originalEndDate ?? r.endDate, extendedAt: new Date() })
      .where(eq(reservations.id, id));
    await db.insert(auditLogs).values({ actorId, entity: "reservation", entityId: id, action: "extend", changes: { from: r.endDate, to: newEndDate, days, total } });
    return { ok: true as const, data: { days, total } };
}

/**
 * Prolongation d'une location confirmée ou en cours par l'équipe : nouvelle date de retour, prix recalculé avec le même
 * prix par jour et les mêmes options. La base refuse si la voiture est déjà réservée sur les nouveaux jours.
 */
export async function extendReservation(id: string, newEndDate: string): Promise<ActionResult<{ days: number; total: number }>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    await assertReservationInScope(staff, id);
    const res = await applyExtension(id, newEndDate, staff.id);
    if (res.ok) revalidatePath("/", "layout");
    return res;
  } catch (err) {
    return toActionError(err);
  }
}

/** Le client demande une prolongation : elle attend l'accord de l'administrateur ou d'un responsable. */
export async function requestExtension(id: string, newEndDate: string, note?: string): Promise<ActionResult> {
  try {
    const user = await assertRole(["client"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newEndDate)) return { ok: false, error: "validation", fieldErrors: { endDate: "date" } };
    const [r] = await db.select().from(reservations).where(and(eq(reservations.id, id), eq(reservations.clientId, user.id))).limit(1);
    if (!r) return { ok: false, error: "not_found" };
    if (!["pending", "confirmed", "ongoing"].includes(r.status)) return { ok: false, error: "invalid_transition" };
    if (newEndDate <= r.endDate) return { ok: false, error: "validation", fieldErrors: { endDate: "dateOrder" } };
    const [open] = await db.select({ id: reservationExtensions.id }).from(reservationExtensions).where(and(eq(reservationExtensions.reservationId, id), eq(reservationExtensions.status, "pending"))).limit(1);
    if (open) return { ok: false, error: "extension_pending" };
    // Les jours demandés doivent être libres.
    const [clash] = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(and(eq(reservations.carId, r.carId), sql`${reservations.id} <> ${id}`, inArray(reservations.status, ["pending", "confirmed", "ongoing"]), sql`${reservations.startDate} < ${newEndDate}`, sql`${reservations.endDate} > ${r.endDate}`))
      .limit(1);
    if (clash) return { ok: false, error: "overlap" };
    const [row] = await db
      .insert(reservationExtensions)
      .values({ reservationId: id, fromEndDate: r.endDate, requestedEndDate: newEndDate, note: note?.trim().slice(0, 1000) || null, requestedBy: user.id })
      .returning({ id: reservationExtensions.id });
    await db.insert(auditLogs).values({ actorId: user.id, entity: "reservation", entityId: id, action: "extension_request", changes: { to: newEndDate } });
    await notifyExtensionRequest(id, row.id, newEndDate).catch((e) => console.error("[email] prolongation", e));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** L'équipe accepte (la location est prolongée) ou refuse la demande de prolongation du client. */
export async function decideExtension(extensionId: string, accept: boolean, reason?: string): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const [ext] = await db.select().from(reservationExtensions).where(eq(reservationExtensions.id, extensionId)).limit(1);
    if (!ext) return { ok: false, error: "not_found" };
    if (ext.status !== "pending") return { ok: false, error: "invalid_transition" };
    await assertReservationInScope(staff, ext.reservationId);
    if (!(await canValidateReservation(staff, ext.reservationId))) return { ok: false, error: "validation_reserved" };
    if (accept) {
      const res = await applyExtension(ext.reservationId, ext.requestedEndDate, staff.id);
      if (!res.ok) return res;
    }
    await db
      .update(reservationExtensions)
      .set({ status: accept ? "accepted" : "refused", decidedBy: staff.id, decidedAt: new Date(), reason: reason?.trim() || null })
      .where(eq(reservationExtensions.id, extensionId));
    await db.insert(auditLogs).values({ actorId: staff.id, entity: "reservation", entityId: ext.reservationId, action: accept ? "extension_accept" : "extension_refuse", changes: { to: ext.requestedEndDate, reason } });
    await notifyExtensionDecision(ext.reservationId, accept, ext.requestedEndDate, reason).catch((e) => console.error("[email] décision prolongation", e));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
