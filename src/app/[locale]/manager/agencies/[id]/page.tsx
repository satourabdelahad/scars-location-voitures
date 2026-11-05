import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { AgencyPage } from "@/features/agencies/pages";

export default async function Page({ params }: PageProps<"/[locale]/manager/agencies/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const me = await requireRole(["manager"], "/manager/agencies");
  
  return <AgencyPage base="/manager" id={id} me={me} />;
}
