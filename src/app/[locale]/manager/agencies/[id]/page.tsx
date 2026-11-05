import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { AgencyPage, parseAgencyTab } from "@/features/agencies/pages";

export default async function Page({ params, searchParams }: PageProps<"/[locale]/manager/agencies/[id]">) {
  const [{ locale, id }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const me = await requireRole(["manager"], "/manager/agencies");
  return <AgencyPage base="/manager" id={id} me={me} tab={parseAgencyTab(sp.tab)} locale={locale} />;
}
