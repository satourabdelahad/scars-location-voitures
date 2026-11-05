import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { NewAgencyPage } from "@/features/agencies/pages";

export default async function Page({ params }: PageProps<"/[locale]/manager/agencies/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["manager"], "/manager/agencies");
  return <NewAgencyPage base="/manager" />;
}
