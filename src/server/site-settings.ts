import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { SITE_PAGES, type SitePage } from "@/lib/site-pages";

/**
 * Réglages du site public, modifiables par l'administrateur (Site public) :
 * coordonnées de contact et textes des pages (À propos, Conditions de location, Confidentialité),
 * un texte par langue. Une langue non renseignée affiche le texte par défaut.
 */
const localized = z.record(z.string(), z.string().max(20000)).default({});
export const siteSettingsSchema = z.object({
  contact: z
    .object({
      address: z.string().trim().max(300).default(""),
      email: z.union([z.literal(""), z.string().trim().toLowerCase().email("email").max(255)]).default(""),
      phone: z.string().trim().max(32).default(""),
      whatsapp: z.string().trim().max(32).default(""),
    })
    .default({ address: "", email: "", phone: "", whatsapp: "" }),
  pages: z.partialRecord(z.enum(SITE_PAGES), localized).default({}),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

let cache: { at: number; value: SiteSettings } | null = null;

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "site")).limit(1);
  const parsed = siteSettingsSchema.safeParse(row?.value ?? {});
  const value = parsed.success ? parsed.data : siteSettingsSchema.parse({});
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSiteSettings(value: SiteSettings, userId: string) {
  await db
    .insert(appSettings)
    .values({ key: "site", value, updatedBy: userId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date(), updatedBy: userId } });
  cache = { at: Date.now(), value };
}

/** Texte saisi pour la page et la langue, sinon null (la page affiche alors le texte par défaut). */
export function pageText(s: SiteSettings, page: SitePage, locale: string) {
  const v = s.pages[page]?.[locale]?.trim();
  return v ? v : null;
}
