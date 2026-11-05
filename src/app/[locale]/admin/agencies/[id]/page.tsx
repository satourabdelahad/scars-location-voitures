import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { AgencyPage, parseAgencyTab } from "@/features/agencies/pages";

export default async function Page({ params, searchParams }: PageProps<"/[locale]/admin/agencies/[id]">) {
  const [{ locale, id }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const me = await requireRole(["admin"], "/admin/agencies");
  return <AgencyPage base="/admin" id={id} me={me} tab={parseAgencyTab(sp.tab)} locale={locale} />;
}
