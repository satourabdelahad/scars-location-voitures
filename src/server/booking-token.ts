import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Jeton court (5 min) émis par le serveur juste après la création d'une fiche client à la réservation,
 * pour connecter ce client sans mot de passe. Jamais transmis au navigateur.
 */
const secret = () => `${process.env.AUTH_SECRET ?? ""}:booking`;
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function mintBookingToken(userId: string) {
  const payload = `${userId}.${Date.now() + 5 * 60_000}`;
  return `${payload}.${sign(payload)}`;
}

export function readBookingToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = sign(`${userId}.${exp}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return /^[0-9a-f-]{36}$/i.test(userId) ? userId : null;
}
