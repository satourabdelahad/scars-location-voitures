"use server";

import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { checkTotp, consumeRecoveryCode, looksLikeRecoveryCode, newRecoveryCodes, newTotpSecret, openSecret, sealSecret, totpUri } from "@/server/security";

/** Double authentification : réservée à l'administrateur. */
async function currentAdmin() {
  const admin = await assertRole(["admin"]);
  const [row] = await db.select().from(users).where(eq(users.id, admin.id)).limit(1);
  if (!row) throw new Error("not_found");
  return row;
}

async function log(userId: string, action: string, changes?: Record<string, unknown>) {
  await db.insert(auditLogs).values({ actorId: userId, entity: "security", entityId: userId, action, changes: changes ?? null });
}

/** Étape 1 : nouveau secret (en attente tant qu'il n'est pas confirmé par un code). */
export async function startTwoFactorSetup(): Promise<ActionResult<{ secret: string; qr: string }>> {
  try {
    const me = await currentAdmin();
    if (me.totpEnabledAt) return { ok: false, error: "invalid_transition" };
    const secret = newTotpSecret();
    await db.update(users).set({ totpPendingSecret: sealSecret(secret) }).where(eq(users.id, me.id));
    const qr = await QRCode.toDataURL(totpUri(secret, me.email ?? "admin"), { margin: 1, width: 240, color: { dark: "#141826", light: "#ffffff" } });
    return { ok: true, data: { secret, qr } };
  } catch (err) {
    return toActionError(err);
  }
}

/** Étape 2 : le code de l'application confirme que le téléphone est bien configuré. */
export async function confirmTwoFactor(code: string): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  try {
    const me = await currentAdmin();
    if (!me.totpPendingSecret) return { ok: false, error: "invalid_transition" };
    const secret = openSecret(me.totpPendingSecret);
    const step = checkTotp(secret, code, null);
    if (step === null) return { ok: false, error: "totp_invalid", fieldErrors: { code: "totp_invalid" } };
    const { codes, hashes } = newRecoveryCodes();
    await db
      .update(users)
      .set({ totpSecret: me.totpPendingSecret, totpPendingSecret: null, totpEnabledAt: new Date(), totpLastStep: step, totpRecoveryCodes: hashes })
      .where(eq(users.id, me.id));
    await log(me.id, "2fa_enabled");
    revalidatePath(`/${await getLocale()}/admin`, "layout");
    return { ok: true, data: { recoveryCodes: codes } };
  } catch (err) {
    return toActionError(err);
  }
}

/** Vérifie un code de l'application ou un code de secours pour une action sensible. */
async function verifyFor(me: typeof users.$inferSelect, code: string) {
  if (!me.totpSecret) return false;
  const step = checkTotp(openSecret(me.totpSecret), code, me.totpLastStep);
  if (step !== null) {
    await db.update(users).set({ totpLastStep: step }).where(eq(users.id, me.id));
    return true;
  }
  const left = looksLikeRecoveryCode(code) ? consumeRecoveryCode(me.totpRecoveryCodes, code) : null;
  if (!left) return false;
  await db.update(users).set({ totpRecoveryCodes: left }).where(eq(users.id, me.id));
  return true;
}

export async function regenerateRecoveryCodes(code: string): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  try {
    const me = await currentAdmin();
    if (!(await verifyFor(me, code))) return { ok: false, error: "totp_invalid", fieldErrors: { code: "totp_invalid" } };
    const { codes, hashes } = newRecoveryCodes();
    await db.update(users).set({ totpRecoveryCodes: hashes }).where(eq(users.id, me.id));
    await log(me.id, "2fa_recovery_regenerated");
    revalidatePath(`/${await getLocale()}/admin/security`);
    return { ok: true, data: { recoveryCodes: codes } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function disableTwoFactor(code: string): Promise<ActionResult> {
  try {
    const me = await currentAdmin();
    if (!(await verifyFor(me, code))) return { ok: false, error: "totp_invalid", fieldErrors: { code: "totp_invalid" } };
    await db
      .update(users)
      .set({ totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecoveryCodes: null })
      .where(eq(users.id, me.id));
    await log(me.id, "2fa_disabled");
    revalidatePath(`/${await getLocale()}/admin`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
