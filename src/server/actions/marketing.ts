"use server";

import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, marketingCampaigns, marketingRecipients, promotions, users } from "@/db/schema";
import { fillTemplate } from "@/lib/email-template-defs";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { brandedEmail } from "@/server/email";
import { getTemplate } from "@/server/email-templates";
import { marketingVars, sendMarketingCampaign } from "@/server/notifications";
import { isLocale, type Locale } from "@/i18n/config";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date");

const campaignSchema = z.object({
  name: z.string().trim().min(3, "required").max(160),
  message: z.string().trim().max(2000).optional().transform((v) => v || null),
  percent: z.coerce.number().int("numberRange").min(1, "numberRange").max(90, "numberRange"),
  endsOn: isoDate.refine((d) => d >= new Date().toISOString().slice(0, 10), "futureDate"),
  minDays: z.coerce.number().int().min(1, "numberRange").max(60, "numberRange").default(1),
  clientIds: z.array(z.string().uuid()).min(1, "required").max(5000),
  filters: z.object({
    cities: z.array(z.string().max(120)).max(100).default([]),
    minDays: z.number().int().min(0).nullable().default(null),
    maxDays: z.number().int().min(0).nullable().default(null),
    search: z.string().max(120).optional(),
  }),
});

function fieldErrors(issues: z.core.$ZodIssue[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Code lisible tiré du nom de la campagne : « HIVER-7KQ2 ». */
function makeCode(name: string) {
  // Premier mot du nom (lettres et chiffres), 8 caractères au plus : « Hiver 2026 » → HIVER.
  const first = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, "")).find(Boolean) ?? "";
  const head = first.toUpperCase().slice(0, 8) || "DIZY";
  const bytes = randomBytes(4);
  const tail = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${head}-${tail}`;
}

/** Aperçu de l'email (modèle de la langue de l'interface, avec le premier destinataire ou un exemple). */
export async function previewMarketingEmail(input: { message?: string; percent: number; endsOn: string; minDays: number; name: string }): Promise<ActionResult<{ subject: string; html: string }>> {
  try {
    await assertRole(["admin", "manager"]);
    const locale = await getLocale();
    const l: Locale = isLocale(locale) ? locale : "fr";
    const tpl = await getTemplate("marketing_promotion", l);
    const { vars } = await marketingVars(
      { civility: "male", first: "Youssef", last: "Alaoui", locale: l },
      { message: input.message?.trim() || null, code: makeCode(input.name || "promo"), percent: Number(input.percent) || 10, endsOn: input.endsOn || null, minDays: Number(input.minDays) || 1 },
      "https://dizy-cars.com",
    );
    const all = { site: "Dizy Cars", ...vars };
    return { ok: true, data: { subject: fillTemplate(tpl.subject, all, { html: false }), html: brandedEmail(fillTemplate(tpl.html, all, { html: true }), l) } };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Crée le code de réduction (réservé aux destinataires), la campagne et ses destinataires, puis envoie les emails.
 * Le code est attribué à chaque client quand il clique sur le bouton de son email.
 */
export async function sendCampaign(input: unknown): Promise<ActionResult<{ id: number; code: string; sent: number; failed: number; skipped: number }>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const p = campaignSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(p.error.issues) };
    const c = p.data;
    // Seuls des clients actifs avec un email reçoivent la campagne.
    const targets = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(inArray(users.id, [...new Set(c.clientIds)]), eq(users.role, "client"), eq(users.status, "active"), isNotNull(users.email)));
    if (!targets.length) return { ok: false, error: "validation", fieldErrors: { clientIds: "required" } };

    const created = await db.transaction(async (tx) => {
      let promo: { id: number; code: string } | undefined;
      for (let i = 0; i < 5 && !promo; i++) {
        const code = makeCode(c.name);
        [promo] = await tx
          .insert(promotions)
          .values({ code, label: c.name, kind: "percent", value: c.percent, minDays: c.minDays, endsOn: c.endsOn, restricted: true, createdBy: staff.id })
          .onConflictDoNothing()
          .returning({ id: promotions.id, code: promotions.code });
      }
      if (!promo) throw new Error("promo_code");
      const [camp] = await tx
        .insert(marketingCampaigns)
        .values({ name: c.name, message: c.message, promotionId: promo.id, filters: c.filters, recipientCount: targets.length, createdBy: staff.id })
        .returning({ id: marketingCampaigns.id });
      await tx.insert(marketingRecipients).values(targets.map((t) => ({ campaignId: camp.id, clientId: t.id, email: t.email!, token: randomBytes(24).toString("base64url") })));
      await tx.insert(auditLogs).values({
        actorId: staff.id,
        entity: "marketing",
        entityId: String(camp.id),
        action: "send",
        changes: { title: c.name, note: `${targets.length} · -${c.percent} % · ${promo.code}`, filters: c.filters },
      });
      return { id: camp.id, code: promo.code };
    });
    const res = await sendMarketingCampaign(created.id);
    revalidatePath("/", "layout");
    return { ok: true, data: { ...created, ...res } };
  } catch (err) {
    return toActionError(err);
  }
}
