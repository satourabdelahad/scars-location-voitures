import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { AgenciesListPage } from "@/features/agencies/pages";

export default async function Page({ params }: PageProps<"/[locale]/admin/agencies">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole(["admin"], "/admin/agencies");
  
  return <AgenciesListPage base="/admin" me={me} />;
}
