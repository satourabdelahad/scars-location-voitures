import "server-only";
import { Resend } from "resend";
import { createTranslator } from "next-intl";
import { isLocale, localeMeta, type Locale } from "@/i18n/config";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "SCar Location <onboarding@resend.dev>";
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
    <tr><td style="background:#141a2e;padding:22px 28px;color:#fff;font-size:20px;font-weight:800;letter-spacing:.5px">SCar<span style="color:#f2b53a">.</span></td></tr>
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
