import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/server/guards";
import { getAlertSettings } from "@/server/app-settings";
import { AlertSettingsForm } from "@/features/administration/alert-settings-form";

export default async function AlertSettingsPage({ params }: PageProps<"/[locale]/admin/alerts">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"], "/admin/alerts");
  const [t, settings] = await Promise.all([getTranslations("AlertSettings"), getAlertSettings()]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <AlertSettingsForm initial={settings} />
    </>
  );
}
