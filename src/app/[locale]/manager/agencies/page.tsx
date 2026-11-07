import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { AgenciesListPage } from "@/features/agencies/pages";

export default async function Page({ params }: PageProps<"/[locale]/manager/agencies">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole(["manager"], "/manager/agencies");
  
  return <AgenciesListPage base="/manager" me={me} />;
}
