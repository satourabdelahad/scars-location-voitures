import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { SiteSettingsForm } from "@/features/site/site-settings-form";
import { locales } from "@/i18n/config";
import { defaultPageText } from "@/lib/site-page-defaults";
import { SITE_PAGES, type SitePage } from "@/lib/site-pages";
import { requireRole } from "@/server/guards";
import { getSiteSettings } from "@/server/site-settings";

export default async function SitePage({ params }: PageProps<"/[locale]/admin/site">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"], "/admin/site");
  const [t, settings] = await Promise.all([getTranslations("Site"), getSiteSettings()]);
  const defaults = Object.fromEntries(locales.map((l) => [l, Object.fromEntries(SITE_PAGES.map((p) => [p, defaultPageText(p, l)])) as Record<SitePage, string>]));
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SiteSettingsForm initial={settings} defaults={defaults} uiLocale={locale} />
    </>
  );
}
