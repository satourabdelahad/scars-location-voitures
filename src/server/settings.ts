import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

/** Réglages de sécurité, modifiables par l'administrateur (Administration → Sécurité). */
export const securitySettingsSchema = z.object({
  maxEmailFailures: z.coerce.number().int().min(3, "number").max(20, "number"),
  lockMinutes: z.coerce.number().int().min(1, "number").max(1440, "number"),
  maxIpFailures: z.coerce.number().int().min(5, "number").max(500, "number"),
  staffSessionHours: z.coerce.number().int().min(1, "number").max(168, "number"),
  clientSessionDays: z.coerce.number().int().min(1, "number").max(90, "number"),
});
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;

export const DEFAULT_SECURITY: SecuritySettings = {
  maxEmailFailures: 5,
  lockMinutes: 15,
  maxIpFailures: 20,
  staffSessionHours: 12,
  clientSessionDays: 14,
};
/** Plafond de la durée du cookie de session : la vraie limite est vérifiée à chaque requête. */
export const MAX_CLIENT_SESSION_DAYS = 90;

let cache: { at: number; value: SecuritySettings } | null = null;

/** Lu à chaque connexion et à chaque requête authentifiée : mis en cache 30 secondes. */
export async function getSecuritySettings(): Promise<SecuritySettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "security")).limit(1);
  const parsed = securitySettingsSchema.safeParse({ ...DEFAULT_SECURITY, ...((row?.value as object) ?? {}) });
  const value = parsed.success ? parsed.data : DEFAULT_SECURITY;
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSecuritySettings(value: SecuritySettings, userId: string) {
  await db
    .insert(appSettings)
    .values({ key: "security", value, updatedBy: userId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date(), updatedBy: userId } });
  cache = { at: Date.now(), value };
}
