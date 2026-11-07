import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/db";
import { passwordTokens } from "@/db/schema";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Crée un jeton à usage unique ; seul son hash est conservé en base. Jamais exposé comme action serveur. */
export async function issuePasswordToken(userId: string, purpose: "invite" | "reset") {
  const token = randomBytes(32).toString("base64url");
  const hours = purpose === "invite" ? 24 * 7 : 1;
  await db.insert(passwordTokens).values({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + hours * 3_600_000),
  });
  return token;
}
