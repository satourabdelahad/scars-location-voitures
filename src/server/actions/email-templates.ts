"use server";

import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, emailTemplates } from "@/db/schema";
import { emailButton, fillTemplate, TEMPLATE_KEYS, TEMPLATE_VARIABLES, type TemplateKey } from "@/lib/email-template-defs";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { brandedEmail, sendTemplate } from "@/server/email";
import { cleanTemplateHtml } from "@/server/email-templates";

const schema = z.object({
  key: z.enum(TEMPLATE_KEYS),
  subject: z.string().trim().min(3, "required").max(300),
  html: z.string().trim().min(10, "required").max(100_000),
});

function sampleVars(key: TemplateKey) {
  const vars = Object.fromEntries(TEMPLATE_VARIABLES[key].map((v) => [v.key, v.sample]));
  for (const k of Object.keys(vars)) if (k.startsWith("bouton_")) vars[k] = emailButton("Bouton d'action", "https://dizy-cars.com");
  return vars;
}

export async function saveEmailTemplate(input: unknown): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const p = schema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation", fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
    const html = cleanTemplateHtml(p.data.html);
    await db
      .insert(emailTemplates)
      .values({ key: p.data.key, subject: p.data.subject, html, updatedBy: admin.id })
      .onConflictDoUpdate({ target: emailTemplates.key, set: { subject: p.data.subject, html, updatedAt: new Date(), updatedBy: admin.id } });
    await db.insert(auditLogs).values({ actorId: admin.id, entity: "email_template", entityId: p.data.key, action: "update" });
    revalidatePath(`/${await getLocale()}/admin/administration`);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Revient au modèle livré avec le site. */
export async function resetEmailTemplate(key: TemplateKey): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    if (!TEMPLATE_KEYS.includes(key)) return { ok: false, error: "validation" };
    await db.delete(emailTemplates).where(eq(emailTemplates.key, key));
    await db.insert(auditLogs).values({ actorId: admin.id, entity: "email_template", entityId: key, action: "reset" });
    revalidatePath(`/${await getLocale()}/admin/administration`);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Aperçu avec des valeurs d'exemple, dans l'habillage réel de l'email. */
export async function previewEmailTemplate(input: unknown): Promise<ActionResult<{ subject: string; html: string }>> {
  try {
    await assertRole(["admin"]);
    const p = schema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation" };
    const vars = sampleVars(p.data.key);
    return { ok: true, data: { subject: fillTemplate(p.data.subject, vars, { html: false }), html: brandedEmail(fillTemplate(cleanTemplateHtml(p.data.html), vars, { html: true })) } };
  } catch (err) {
    return toActionError(err);
  }
}

/** Envoie le modèle enregistré, avec les valeurs d'exemple, à l'adresse de l'administrateur. */
export async function sendTestEmailTemplate(key: TemplateKey): Promise<ActionResult<{ to: string }>> {
  try {
    const admin = await assertRole(["admin"]);
    if (!admin.email || !TEMPLATE_KEYS.includes(key)) return { ok: false, error: "validation" };
    await sendTemplate(key, [{ to: admin.email, vars: sampleVars(key) }]);
    return { ok: true, data: { to: admin.email } };
  } catch (err) {
    return toActionError(err);
  }
}
