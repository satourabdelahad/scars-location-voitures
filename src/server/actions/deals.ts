"use server";

import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clientProfiles, dealEvents, deals, dealSourceEnum, dealTypeEnum, managers, users } from "@/db/schema";
import { casablancaToDate } from "@/lib/casablanca-time";
import { isLocale, type Locale } from "@/i18n/config";
import { formatDate } from "@/lib/utils";
import { APP_BASE_URL, emailButton, sendTemplate } from "@/server/email";
import { staffName } from "@/server/queries/clients";
import { ActionError, assertRole, toActionError, type ActionResult } from "@/server/guards";
import { canViewManager } from "@/server/queries/manager-profile";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date")
  .or(z.literal(""))
  .optional()
  .transform((v) => v || null);

/**
 * Prospect : le lien vers un client est obligatoire (nom, téléphone, email et ville viennent de sa fiche).
 * source = type de prospection (appel, WhatsApp, visite…), contactDate + contactTime = moment de l'échange.
 */
const dealSchema = z.object({
  clientId: z.string({ error: "required" }).uuid("required"),
  source: z.enum(dealSourceEnum.enumValues),
  type: z.enum(dealTypeEnum.enumValues),
  contactDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
  contactTime: z.string().regex(/^\d{2}:\d{2}$/, "required"),
  carId: z
    .string()
    .uuid()
    .or(z.literal(""))
    .optional()
    .transform((v) => v || null),
  promotionId: z.coerce
    .number()
    .int()
    .positive()
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  amount: z
    .union([z.literal(""), z.coerce.number().min(0, "number")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  expectedDate: optionalDate,
  nextFollowUp: optionalDate,
  nextAction: optionalText(1000),
  notes: optionalText(4000),
});

/** Coordonnées du client lié, recopiées sur le prospect. */
async function clientContact(clientId: string) {
  const [c] = await db
    .select({ name: users.name, email: users.email, phone: users.phone, role: users.role, first: clientProfiles.firstName, last: clientProfiles.lastName, city: clientProfiles.city, whatsapp: clientProfiles.whatsapp })
    .from(users)
    .leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
    .where(eq(users.id, clientId))
    .limit(1);
  if (!c || c.role !== "client") return null;
  return {
    prospectName: (c.first ? `${c.first} ${c.last}` : (c.name ?? c.email ?? "—")).slice(0, 160),
    phone: c.phone ?? c.whatsapp ?? "",
    email: c.email,
    city: c.city,
  };
}

function toRow(d: z.infer<typeof dealSchema>) {
  const { contactDate, contactTime, ...rest } = d;
  return { ...rest, contactAt: casablancaToDate(contactDate, contactTime) };
}

function fieldErrors(issues: z.core.$ZodIssue[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/**
 * Admin : tous les deals. Gestionnaire : ses deals, et ceux qui ne sont suivis par personne
 * (ex. créés par l'administration sur une fiche client).
 */
async function assertDealAccess(deal: { managerId: string | null }) {
  const viewer = await assertRole(["admin", "manager"]);
  if (viewer.role === "admin" || deal.managerId === null) return viewer;
  if (!(await canViewManager(viewer, deal.managerId))) throw new ActionError("forbidden");
  return viewer;
}

async function ownManagerId(userId: string) {
  const [m] = await db.select({ id: managers.id }).from(managers).where(eq(managers.userId, userId)).limit(1);
  return m?.id ?? null;
}

/**
 * Nouveau deal. Depuis une fiche gestionnaire : scope.managerId. Depuis une fiche client : scope.clientId
 * (le deal est alors suivi par le gestionnaire connecté, ou par l'administration).
 */
export async function createDeal(scope: { managerId?: string | null; clientId?: string | null }, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const viewer = await assertRole(["admin", "manager"]);
    const managerId = scope.managerId ?? (viewer.role === "manager" ? await ownManagerId(viewer.id) : null);
    await assertDealAccess({ managerId });
    const parsed = dealSchema.safeParse({ ...(input as object), ...(scope.clientId ? { clientId: scope.clientId } : {}) });
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
    const contact = await clientContact(parsed.data.clientId);
    if (!contact) return { ok: false, error: "validation", fieldErrors: { clientId: "required" } };
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(deals)
        .values({ ...toRow(parsed.data), ...contact, managerId, createdBy: viewer.id, updatedBy: viewer.id })
        .returning({ id: deals.id });
      await tx.insert(dealEvents).values({ dealId: row.id, toType: parsed.data.type, actorId: viewer.id });
      return row.id;
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateDeal(dealId: string, input: unknown): Promise<ActionResult> {
  try {
    const [current] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!current) return { ok: false, error: "not_found" };
    const viewer = await assertDealAccess(current);
    const parsed = dealSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
    const contact = await clientContact(parsed.data.clientId);
    if (!contact) return { ok: false, error: "validation", fieldErrors: { clientId: "required" } };
    await db.transaction(async (tx) => {
      await tx.update(deals).set({ ...toRow(parsed.data), ...contact, updatedBy: viewer.id }).where(eq(deals.id, dealId));
      if (parsed.data.type !== current.type) {
        await tx.insert(dealEvents).values({ dealId, fromType: current.type, toType: parsed.data.type, actorId: viewer.id });
      }
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addDealNote(dealId: string, note: string): Promise<ActionResult> {
  try {
    const clean = z.string().trim().min(2).max(2000).safeParse(note);
    if (!clean.success) return { ok: false, error: "validation", fieldErrors: { note: "minLength" } };
    const [current] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!current) return { ok: false, error: "not_found" };
    const viewer = await assertDealAccess(current);
    await db.transaction(async (tx) => {
      await tx.insert(dealEvents).values({ dealId, fromType: current.type, toType: current.type, note: clean.data, actorId: viewer.id });
      // Le deal remonte en haut de la liste.
      await tx.update(deals).set({ updatedBy: viewer.id }).where(eq(deals.id, dealId));
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * « Envoyer au client » : récapitulatif de l'échange (modèle "Suivi de prospection"),
 * dans la langue du client, signé par l'auteur de l'envoi.
 */
export async function sendDealToClient(dealId: string): Promise<ActionResult<{ to: string }>> {
  try {
    const [d] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!d) return { ok: false, error: "not_found" };
    const viewer = await assertDealAccess(d);
    if (!d.clientId) return { ok: false, error: "no_client_email" };
    const [c] = await db
      .select({ email: users.email, locale: users.preferredLocale, first: clientProfiles.firstName, last: clientProfiles.lastName, name: users.name })
      .from(users)
      .leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
      .where(eq(users.id, d.clientId))
      .limit(1);
    if (!c?.email) return { ok: false, error: "no_client_email" };
    const [me] = await db.select({ email: users.email, phone: users.phone }).from(users).where(eq(users.id, viewer.id)).limit(1);
    const [mine] = await db.select({ phone: managers.phone }).from(managers).where(eq(managers.userId, viewer.id)).limit(1);
    const who = await staffName(viewer.id);
    const l: Locale = isLocale(c.locale ?? "") ? (c.locale as Locale) : "fr";
    const messages = (await import(`../../messages/${l}.json`)).default;
    const td = createTranslator({ locale: l, messages, namespace: "Deals" });
    const tm = createTranslator({ locale: l, messages, namespace: "Email" });
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Casablanca", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d.contactAt);
    const dateIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(d.contactAt);
    const [first, ...rest] = (c.name ?? "").split(" ");
    const link = `${APP_BASE_URL}/${l}/cars`;
    const res = await sendTemplate("prospect_followup", [
      {
        to: c.email,
        locale: l,
        vars: {
          prenom: c.first ?? first ?? "",
          nom: c.last ?? rest.join(" "),
          type_prospection: td(`sources.${d.source}`),
          date: formatDate(dateIso, l),
          heure: time,
          note: d.notes ?? "",
          prochaine_action: d.nextAction ?? "—",
          gestionnaire: who?.name ?? "Dizy Cars",
          gestionnaire_telephone: mine?.phone ?? me?.phone ?? "",
          gestionnaire_email: me?.email ?? "",
          lien_site: link,
          bouton_site: emailButton(tm("tplBtnCars"), link),
        },
      },
    ]);
    if (res.failed) return { ok: false, error: "email_failed" };
    if (res.skipped) return { ok: false, error: "email_not_configured" };
    await db.transaction(async (tx) => {
      await tx.update(deals).set({ sentToClientAt: new Date(), updatedBy: viewer.id }).where(eq(deals.id, dealId));
      await tx.insert(dealEvents).values({ dealId, fromType: d.type, toType: d.type, note: tm("sentToClientNote", { email: c.email! }), actorId: viewer.id });
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { to: c.email } };
  } catch (err) {
    return toActionError(err);
  }
}
