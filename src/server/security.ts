import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { Secret, TOTP } from "otpauth";
import { db } from "@/db";
import { loginFailures } from "@/db/schema";

/* ───────────── Blocage des essais de connexion ───────────── */

export const LOCK_WINDOW_MIN = 15;
const MAX_PER_EMAIL = 5;
/** Plus large par adresse IP : une agence entière peut partager la même connexion. */
const MAX_PER_IP = 20;

export function loginKeys(email: string, ip: string | null) {
  return { email: `email:${email.toLowerCase()}`, ip: ip ? `ip:${ip}` : null };
}

/** Vrai si l'email ou l'IP a dépassé le nombre d'échecs autorisés sur les 15 dernières minutes. */
export async function isLoginLocked(keys: { email: string; ip: string | null }) {
  const since = new Date(Date.now() - LOCK_WINDOW_MIN * 60_000);
  const wanted = [keys.email, ...(keys.ip ? [keys.ip] : [])];
  const rows = await db
    .select({ key: loginFailures.key, n: sql<number>`count(*)::int` })
    .from(loginFailures)
    .where(and(inArray(loginFailures.key, wanted), gt(loginFailures.createdAt, since)))
    .groupBy(loginFailures.key);
  return rows.some((r) => (r.key === keys.email ? r.n >= MAX_PER_EMAIL : r.n >= MAX_PER_IP));
}

export async function recordLoginFailure(keys: { email: string; ip: string | null }) {
  await db.insert(loginFailures).values([{ key: keys.email }, ...(keys.ip ? [{ key: keys.ip }] : [])]);
  // Ménage : on ne garde qu'une journée d'historique.
  if (Math.random() < 0.05) await db.delete(loginFailures).where(lt(loginFailures.createdAt, new Date(Date.now() - 86_400_000)));
}

/** Connexion réussie : le compteur de l'email repart à zéro (celui de l'IP reste, il protège les autres comptes). */
export async function clearLoginFailures(keys: { email: string }) {
  await db.delete(loginFailures).where(eq(loginFailures.key, keys.email));
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
