import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/server/guards";
import { ManagerForm } from "@/features/managers/manager-form";

export default async function NewManagerPage({ params }: PageProps<"/[locale]/admin/managers/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"]);
  const t = await getTranslations("Managers");
  return (
    <>
      <PageHeader title={t("createTitle")} />
      <ManagerForm />
    </>
  );
}
