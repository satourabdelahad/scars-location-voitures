import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireRole } from "@/server/guards";
import { getManager } from "@/server/queries/managers";
import { ManagerProfile, parseTab } from "@/features/managers/manager-profile";

/** Fiche d'un autre gestionnaire, en lecture seule. */
export default async function Page({ params, searchParams }: PageProps<"/[locale]/manager/managers/[id]">) {
  const [{ locale, id }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const viewer = await requireRole(["manager"], "/manager/managers");
  const m = await getManager(id);
  if (!m) notFound();
  if (m.userId === viewer.id) redirect({ href: "/manager/profile", locale });
  return <ManagerProfile manager={m} viewer={viewer} basePath={`/manager/managers/${m.id}`} tab={parseTab(sp.tab)} edit={false} locale={locale} />;
}
