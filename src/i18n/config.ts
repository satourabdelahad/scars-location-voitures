/** Langues du site, dans l'ordre du sélecteur. Pur module partagé client/serveur. */
export const locales = ["fr", "ary", "ar", "en", "es", "de", "ja", "zh", "ko"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export const localeMeta: Record<Locale, { label: string; native: string; dir: "ltr" | "rtl"; intl: string; flag: string }> = {
  fr: { label: "Français", native: "Français", dir: "ltr", intl: "fr-MA", flag: "FR" },
  ary: { label: "Darija", native: "الدارجة", dir: "rtl", intl: "ar-MA", flag: "MA" },
  ar: { label: "Arabe", native: "العربية", dir: "rtl", intl: "ar-MA", flag: "AR" },
  en: { label: "English", native: "English", dir: "ltr", intl: "en-GB", flag: "EN" },
  es: { label: "Español", native: "Español", dir: "ltr", intl: "es-ES", flag: "ES" },
  de: { label: "Deutsch", native: "Deutsch", dir: "ltr", intl: "de-DE", flag: "DE" },
  ja: { label: "日本語", native: "日本語", dir: "ltr", intl: "ja-JP", flag: "JA" },
  zh: { label: "中文", native: "中文", dir: "ltr", intl: "zh-CN", flag: "ZH" },
  ko: { label: "한국어", native: "한국어", dir: "ltr", intl: "ko-KR", flag: "KO" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Les API Intl ne connaissent pas "ary" : on utilise le code régional le plus proche. */
export function intlLocale(locale: string) {
  return isLocale(locale) ? localeMeta[locale].intl : "fr-MA";
}
