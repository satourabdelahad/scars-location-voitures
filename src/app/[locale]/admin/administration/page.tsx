import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { TEMPLATE_KEYS } from "@/lib/email-template-defs";
import { requireRole } from "@/server/guards";
import { getTemplate } from "@/server/email-templates";
import { TemplatesEditor } from "@/features/administration/templates-editor";

export default async function AdministrationPage({ params }: PageProps<"/[locale]/admin/administration">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"], "/admin/administration");
  const [t, ...templates] = await Promise.all([getTranslations("Admin"), ...TEMPLATE_KEYS.map((k) => getTemplate(k))]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <TemplatesEditor
        locale={locale}
        templates={TEMPLATE_KEYS.map((key, i) => ({
          key,
          subject: templates[i].subject,
          html: templates[i].html,
          custom: templates[i].custom,
          updatedAt: templates[i].updatedAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
