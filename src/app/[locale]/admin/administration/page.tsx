import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { TEMPLATE_KEYS } from "@/lib/email-template-defs";
import { locales } from "@/i18n/config";
import { requireRole } from "@/server/guards";
import { getTemplate } from "@/server/email-templates";
import { TemplatesEditor } from "@/features/administration/templates-editor";

export default async function AdministrationPage({ params }: PageProps<"/[locale]/admin/administration">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"], "/admin/administration");
  const t = await getTranslations("Admin");
  // Un modèle par type et par langue.
  const templates = await Promise.all(
    TEMPLATE_KEYS.map(async (key) => ({
      key,
      byLocale: Object.fromEntries(
        await Promise.all(
          locales.map(async (l) => {
            const tpl = await getTemplate(key, l);
            return [l, { subject: tpl.subject, html: tpl.html, custom: tpl.custom, updatedAt: tpl.updatedAt?.toISOString() ?? null }] as const;
          }),
        ),
      ),
    })),
  );
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <TemplatesEditor locale={locale} templates={templates} />
    </>
  );
}
