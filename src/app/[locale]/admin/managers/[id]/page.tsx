import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { getManager } from "@/server/queries/managers";
import { ManagerProfile, parseTab } from "@/features/managers/manager-profile";

export default async function ManagerDetailPage({ params, searchParams }: PageProps<"/[locale]/admin/managers/[id]">) {
  const [{ locale, id }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const viewer = await requireRole(["admin"]);
  const m = await getManager(id);
  if (!m) notFound();
  // La fiche de l'administrateur, c'est son profil.
  if (m.user?.role === "admin") redirect({ href: "/admin/profile", locale });
  return <ManagerProfile manager={m} viewer={viewer} basePath={`/admin/managers/${m.id}`} tab={parseTab(sp.tab)} edit={sp.edit === "1"} locale={locale} />;
}
