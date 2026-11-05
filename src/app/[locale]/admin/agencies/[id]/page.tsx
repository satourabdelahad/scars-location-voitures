import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { AgencyPage } from "@/features/agencies/pages";

export default async function Page({ params }: PageProps<"/[locale]/admin/agencies/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const me = await requireRole(["admin"], "/admin/agencies");
  
  return <AgencyPage base="/admin" id={id} me={me} />;
}
