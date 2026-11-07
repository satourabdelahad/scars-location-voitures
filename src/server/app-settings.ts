import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { DEFAULT_CONTRACT_BODY, DEFAULT_CONTRACT_HEADER } from "@/lib/contract";

/** Seuils des alertes (en jours ou en km), réglés par l'administrateur. */
export const alertSettingsSchema = z.object({
  insuranceDays: z.coerce.number().int().min(1, "number").max(365, "number"),
  vignetteDays: z.coerce.number().int().min(1, "number").max(365, "number"),
  oilDays: z.coerce.number().int().min(1, "number").max(365, "number"),
  oilKm: z.coerce.number().int().min(0, "number").max(20000, "number"),
  inspectionDays: z.coerce.number().int().min(1, "number").max(365, "number"),
  /** « Voiture à nouveau disponible » : affichée pendant ce nombre d'heures après le retour ou la fin de réparation */
  availableHours: z.coerce.number().int().min(1, "number").max(168, "number"),
});
export type AlertSettings = z.infer<typeof alertSettingsSchema>;
export const DEFAULT_ALERTS: AlertSettings = { insuranceDays: 30, vignetteDays: 30, oilDays: 15, oilKm: 1000, inspectionDays: 30, availableHours: 24 };

/** Modèle du contrat de location : en-tête (logo, société) et corps, en HTML avec variables {…}. */
export const contractSettingsSchema = z.object({
  headerHtml: z.string().max(50_000),
  bodyHtml: z.string().max(200_000),
  /** Logo inséré par la variable {company_logo_img} */
  logoUrl: z.union([z.literal(""), z.string().url().max(500)]).default(""),
});
export type ContractSettings = z.infer<typeof contractSettingsSchema>;

const cache = new Map<string, { at: number; value: unknown }>();

async function read<T>(key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30_000) return hit.value as T;
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  const parsed = schema.safeParse({ ...(fallback as object), ...((row?.value as object) ?? {}) });
  const value = parsed.success ? parsed.data : fallback;
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function write(key: string, value: unknown, userId: string) {
  await db
    .insert(appSettings)
    .values({ key, value, updatedBy: userId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date(), updatedBy: userId } });
  cache.set(key, { at: Date.now(), value });
}

export const getAlertSettings = () => read("alerts", alertSettingsSchema, DEFAULT_ALERTS);
export const saveAlertSettings = (v: AlertSettings, userId: string) => write("alerts", v, userId);

export const getContractSettings = () =>
  read("contract", contractSettingsSchema, { headerHtml: DEFAULT_CONTRACT_HEADER, bodyHtml: DEFAULT_CONTRACT_BODY, logoUrl: "" });
export const saveContractSettings = (v: ContractSettings, userId: string) => write("contract", v, userId);
