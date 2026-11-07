import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/server/guards";
import { getContractSettings } from "@/server/app-settings";
import { ContractEditor } from "@/features/administration/contract-editor";

export default async function ContractSettingsPage({ params }: PageProps<"/[locale]/admin/contract">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"], "/admin/contract");
  const [t, settings] = await Promise.all([getTranslations("Contract"), getContractSettings()]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ContractEditor initial={settings} />
    </>
  );
}
