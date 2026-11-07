import "server-only";
import { Resend } from "resend";
import { createTranslator } from "next-intl";
import { isLocale, localeMeta, type Locale } from "@/i18n/config";
import { emailButton, fillTemplate, type TemplateKey } from "@/lib/email-template-defs";
import { getTemplate } from "@/server/email-templates";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "Dizy Cars <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function translator(locale: string) {
  const l: Locale = isLocale(locale) ? locale : "fr";
  const messages = (await import(`../messages/${l}.json`)).default;
  return { t: createTranslator({ locale: l, messages, namespace: "Email" }), locale: l };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(locale: Locale, title: string, body: string, cta?: { label: string; href: string }) {
  const dir = localeMeta[locale].dir;
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;background:#f5f6fa;font-family:Arial,'Segoe UI',sans-serif;color:#141a2e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
    <tr><td style="background:#141a2e;padding:18px 28px"><img src="${APP_URL}/brand/dizy-cars-logo-dark.png" alt="Dizy Cars" width="160" height="60" style="display:block;border:0;height:60px;width:auto"></td></tr>
    <tr><td style="height:4px;background:repeating-linear-gradient(90deg,#f2b53a 0 24px,transparent 24px 40px)"></td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3">${escapeHtml(title)}</h1>
      <div style="font-size:15px;line-height:1.65;color:#3d4560">${body}</div>
      ${cta ? `<p style="margin:26px 0 0"><a href="${cta.href}" style="display:inline-block;background:#4b3fd8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">${escapeHtml(cta.label)}</a></p>` : ""}
    </td></tr>
  </table></td></tr></table></body></html>`;
}

async function send(to: string | null | undefined, subject: string, html: string) {
  if (!to) return { skipped: true as const };
  if (!resend) {
    console.info(`[email] RESEND_API_KEY absent — email non envoyé à ${to} : ${subject}`);
    return { skipped: true as const };
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) console.error("[email] échec Resend", error);
  return { skipped: false as const, error };
}

/** Message envoyé depuis le formulaire de la page Contact du site public. */
export async function sendContactMessage(opts: { to: string; name: string; email: string; phone?: string | null; message: string; locale: string }) {
  if (!resend) {
    console.info(`[email] RESEND_API_KEY absent — message de contact de ${opts.email} non transmis`);
    return { skipped: true as const };
  }
  const body = `<p><strong>${escapeHtml(opts.name)}</strong> &lt;${escapeHtml(opts.email)}&gt;${opts.phone ? ` · ${escapeHtml(opts.phone)}` : ""} · ${escapeHtml(opts.locale)}</p>
<p style="white-space:pre-wrap">${escapeHtml(opts.message)}</p>`;
  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    replyTo: opts.email,
    subject: `Contact — ${opts.name}`,
    html: layout("fr", `Message de ${opts.name}`, body),
  });
  if (error) throw new Error(error.message);
  return { sent: true as const };
}

export async function sendManagerInvite(opts: { to: string; firstName: string; token: string; locale?: string }) {
  const { t, locale } = await translator(opts.locale ?? "fr");
  const href = `${APP_URL}/${locale}/set-password?token=${opts.token}`;
  return send(
    opts.to,
    t("inviteSubject"),
    layout(locale, t("inviteTitle", { name: opts.firstName }), `<p>${escapeHtml(t("inviteBody"))}</p>`, {
      label: t("inviteCta"),
      href,
    }),
  );
}

export async function sendPasswordReset(opts: { to: string; token: string; locale?: string }) {
  const { t, locale } = await translator(opts.locale ?? "fr");
  const href = `${APP_URL}/${locale}/set-password?token=${opts.token}`;
  return send(opts.to, t("resetSubject"), layout(locale, t("resetTitle"), `<p>${escapeHtml(t("resetBody"))}</p>`, { label: t("resetCta"), href }));
}

export type ReservationMail = {
  to: string | null | undefined;
  locale: string;
  reference: string;
  car: string;
  start: string;
  end: string;
  pickup: string;
  total: string;
  reason?: string | null;
};

export async function sendReservationEmail(kind: "received" | "confirmed" | "rejected" | "cancelled", r: ReservationMail) {
  const { t, locale } = await translator(r.locale);
  const rows = [
    [t("labelReference"), r.reference],
    [t("labelCar"), r.car],
    [t("labelDates"), `${r.start} → ${r.end}`],
    [t("labelPickup"), r.pickup],
    [t("labelTotal"), r.total],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#6b7390">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:700;text-align:end">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  const reason = r.reason ? `<p><strong>${escapeHtml(t("labelReason"))}</strong> ${escapeHtml(r.reason)}</p>` : "";
  const body = `<p>${escapeHtml(t(`${kind}Body`))}</p>${reason}<table width="100%" style="border-top:1px solid #e3e5ef;margin-top:14px">${rows}</table>`;
  return send(
    r.to,
    t(`${kind}Subject`, { ref: r.reference }),
    layout(locale, t(`${kind}Title`), body, { label: t("viewReservation"), href: `${APP_URL}/${locale}/account` }),
  );
}

/** Email simple : titre, texte (sauts de ligne conservés) et boutons. */
export async function sendSimpleEmail(to: string, locale: string, subject: string, title: string, text: string, buttons: { label: string; href: string }[] = []) {
  const l: Locale = isLocale(locale) ? locale : "fr";
  const body =
    escapeHtml(text).replace(/\n/g, "<br>") +
    (buttons.length
      ? `<p style="margin:24px 0 0">${buttons.map((b, i) => `<a href="${b.href}" style="display:inline-block;margin:0 8px 8px 0;background:${i ? "#ffffff" : "#4b3fd8"};color:${i ? "#4b3fd8" : "#ffffff"};border:1px solid #4b3fd8;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:700">${escapeHtml(b.label)}</a>`).join("")}</p>`
      : "");
  return send(to, subject, layout(l, title, body));
}

/** Habillage Dizy Cars autour du contenu d'un modèle (en-tête, liseré, carte blanche). */
export function brandedEmail(bodyHtml: string, locale: Locale = "fr") {
  const dir = localeMeta[locale].dir;
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;background:#f5f6fa;font-family:Arial,'Segoe UI',sans-serif;color:#141a2e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
    <tr><td style="background:#141a2e;padding:18px 28px"><img src="${APP_URL}/brand/dizy-cars-logo-dark.png" alt="Dizy Cars" width="160" height="60" style="display:block;border:0;height:60px;width:auto"></td></tr>
    <tr><td style="height:4px;background:repeating-linear-gradient(90deg,#f2b53a 0 24px,transparent 24px 40px)"></td></tr>
    <tr><td style="padding:28px;font-size:15px;line-height:1.65;color:#3d4560">${bodyHtml}</td></tr>
  </table></td></tr></table></body></html>`;
}

export const APP_BASE_URL = APP_URL;
export { emailButton };

/**
 * Envoie un modèle d'email (Administration → Modèles d'email) à chaque destinataire,
 * avec ses propres valeurs de variables (prénom, lien vers son espace…).
 */
export async function sendTemplate(key: TemplateKey, recipients: { to: string | null | undefined; locale?: string | null; vars: Record<string, string> }[]) {
  const seen = new Set<string>();
  const out = { sent: 0, failed: 0, skipped: 0 };
  for (const r of recipients) {
    if (!r.to || seen.has(r.to.toLowerCase())) continue;
    seen.add(r.to.toLowerCase());
    // Chaque destinataire reçoit le modèle de sa langue.
    const locale: Locale = isLocale(r.locale ?? "") ? (r.locale as Locale) : "fr";
    const tpl = await getTemplate(key, locale);
    const vars = { site: "Dizy Cars", ...r.vars };
    const res = await send(r.to, fillTemplate(tpl.subject, vars, { html: false }), brandedEmail(fillTemplate(tpl.html, vars, { html: true }), locale)).catch((e) => {
      console.error(`[email] modèle ${key} vers ${r.to}`, e);
      return { skipped: false as const, error: e };
    });
    if (res.skipped) out.skipped++;
    else if (res.error) out.failed++;
    else out.sent++;
  }
  return out;
}
