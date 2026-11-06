"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { getSiteSettings, saveSiteSettings, siteSettingsSchema } from "@/server/site-settings";
import { sendContactMessage } from "@/server/email";
import { verifyRecaptcha } from "@/server/recaptcha";

function fieldErrors(issues: z.core.$ZodIssue[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path.join(".");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Site public (administrateur) : coordonnées de contact et textes des pages. */
export async function updateSiteSettings(input: unknown): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const p = siteSettingsSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(p.error.issues) };
    await saveSiteSettings(p.data, admin.id);
    await db.insert(auditLogs).values({ actorId: admin.id, entity: "site", entityId: "site", action: "update", changes: { contact: p.data.contact } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

const contactSchema = z.object({
  name: z.string().trim().min(2, "required").max(120),
  email: z.string().trim().toLowerCase().email("email").max(255),
  phone: z.string().trim().max(32).optional().transform((v) => v || null),
  message: z.string().trim().min(10, "messageTooShort").max(4000),
  // Champ invisible : rempli seulement par les robots.
  website: z.string().max(0).optional(),
});

/** Formulaire de la page Contact : le message part par email à l'adresse de contact du site. */
export async function submitContactForm(input: unknown, recaptcha?: string): Promise<ActionResult> {
  try {
    const p = contactSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(p.error.issues) };
    if (!(await verifyRecaptcha(recaptcha, "contact"))) return { ok: false, error: "captcha" };
    const site = await getSiteSettings();
    // Sans adresse de contact configurée, le message va à l'administrateur.
    const to =
      site.contact.email ||
      (await db.select({ email: users.email }).from(users).where(and(eq(users.role, "admin"), eq(users.status, "active"))).limit(1))[0]?.email;
    if (!to) return { ok: false, error: "contact_unavailable" };
    const r = await sendContactMessage({ to, ...p.data, locale: await getLocale() });
    if ("skipped" in r) return { ok: false, error: "contact_unavailable" };
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
