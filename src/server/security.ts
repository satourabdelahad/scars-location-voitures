import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { Secret, TOTP } from "otpauth";
import { db } from "@/db";
import { loginFailures, users } from "@/db/schema";
import { getSecuritySettings } from "@/server/settings";

/* ───────────── Blocage des essais de connexion ───────────── */

export function loginKeys(email: string, ip: string | null) {
  const e = email.toLowerCase();
  return { emailValue: e, email: `email:${e}`, ip: ip ? `ip:${ip}` : null };
}
type Keys = ReturnType<typeof loginKeys>;

/**
 * Vrai si le compte est bloqué (colonne users.login_locked_until) ou si l'adresse IP
 * a dépassé le nombre d'échecs autorisés sur la durée de blocage.
 */
export async function isLoginLocked(keys: Keys) {
  const s = await getSecuritySettings();
  const [u] = await db.select({ until: users.loginLockedUntil }).from(users).where(eq(users.email, keys.emailValue)).limit(1);
  if (u?.until && u.until > new Date()) return true;
  if (!keys.ip) return false;
  const since = new Date(Date.now() - s.lockMinutes * 60_000);
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loginFailures)
    .where(and(eq(loginFailures.key, keys.ip), gt(loginFailures.createdAt, since)));
  return (r?.n ?? 0) >= s.maxIpFailures;
}

/** Enregistre l'échec ; au-delà du seuil, le compte est marqué "bloqué" pour la durée réglée. */
export async function recordLoginFailure(keys: Keys) {
  const s = await getSecuritySettings();
  await db.insert(loginFailures).values([
    { key: keys.email, email: keys.emailValue },
    ...(keys.ip ? [{ key: keys.ip, email: keys.emailValue }] : []),
  ]);
  const since = new Date(Date.now() - s.lockMinutes * 60_000);
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loginFailures)
    .where(and(eq(loginFailures.key, keys.email), gt(loginFailures.createdAt, since)));
  if ((r?.n ?? 0) >= s.maxEmailFailures) {
    await db.update(users).set({ loginLockedUntil: new Date(Date.now() + s.lockMinutes * 60_000) }).where(eq(users.email, keys.emailValue));
  }
  // Ménage : on ne garde qu'une journée d'historique.
  if (Math.random() < 0.05) await db.delete(loginFailures).where(lt(loginFailures.createdAt, new Date(Date.now() - 86_400_000)));
}

/** Connexion réussie : le compteur de l'email repart à zéro (celui de l'IP reste, il protège les autres comptes). */
export async function clearLoginFailures(keys: Keys) {
  await db.delete(loginFailures).where(eq(loginFailures.key, keys.email));
}

/** Déblocage manuel par l'administrateur : compte, compteur de l'email et échecs d'IP liés à cet email. */
export async function unlockAccount(email: string) {
  const e = email.toLowerCase();
  await db.update(users).set({ loginLockedUntil: null }).where(eq(users.email, e));
  await db.delete(loginFailures).where(eq(loginFailures.email, e));
}

/** Adresse IP du visiteur (Netlify, puis proxys standards). */
export function clientIp(headers: Headers) {
  return (
    headers.get("x-nf-client-connection-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

/* ───────────── Double authentification (TOTP) ───────────── */

const ISSUER = "Dizy Cars";

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET manquant");
  return createHash("sha256").update(`dizy-totp:${secret}`).digest();
}

/** Chiffre un secret TOTP avant de l'enregistrer en base. */
export function sealSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function openSecret(sealed: string) {
  const [v, iv, tag, enc] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("totp_secret_format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}

export function newTotpSecret() {
  return new Secret({ size: 20 }).base32;
}

function totp(secretB32: string, label: string) {
  return new TOTP({ issuer: ISSUER, label, algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secretB32) });
}

export function totpUri(secretB32: string, label: string) {
  return totp(secretB32, label).toString();
}

/**
 * Vérifie un code à 6 chiffres (tolérance d'un pas de 30 s pour l'horloge du téléphone).
 * Renvoie le pas accepté, ou null. Un pas déjà utilisé est refusé (code rejoué).
 */
export function checkTotp(secretB32: string, code: string, lastStep: number | null) {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const delta = totp(secretB32, "x").validate({ token: clean, window: 1 });
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 30_000) + delta;
  if (lastStep !== null && step <= lastStep) return null;
  return step;
}

/* ───────────── Codes de secours ───────────── */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const hashCode = (c: string) => createHash("sha256").update(c.replace(/[\s-]/g, "").toUpperCase()).digest("hex");

/** 8 codes du type ABCD-EF23, affichés une seule fois ; seules leurs empreintes sont stockées. */
export function newRecoveryCodes() {
  const codes = Array.from({ length: 8 }, () => {
    const raw = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
  return { codes, hashes: codes.map(hashCode) };
}

/** Renvoie la liste des empreintes restantes si le code de secours est valable, sinon null. */
export function consumeRecoveryCode(hashes: string[] | null, input: string) {
  if (!hashes?.length) return null;
  const h = Buffer.from(hashCode(input), "hex");
  const idx = hashes.findIndex((x) => timingSafeEqual(Buffer.from(x, "hex"), h));
  return idx === -1 ? null : hashes.filter((_, i) => i !== idx);
}

export const looksLikeRecoveryCode = (s: string) => /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(s.trim());
