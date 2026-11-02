import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  // Première visite : la langue du navigateur (en-tête Accept-Language) choisit la langue du site.
  // Ensuite, le choix fait dans le menu est mémorisé dans un cookie.
  localeDetection: true,
  localeCookie: { name: "SCAR_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});
