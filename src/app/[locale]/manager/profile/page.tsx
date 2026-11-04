import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { getManager } from "@/server/queries/managers";
import { managerIdForUser } from "@/server/queries/manager-profile";
import { ManagerProfile, parseTab } from "@/features/managers/manager-profile";

/** "Mon profil" : le gestionnaire consulte sa propre fiche (lecture seule). */
export default async function MyProfilePage({ params, searchParams }: PageProps<"/[locale]/manager/profile">) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const viewer = await requireRole(["manager"], "/manager/profile");
  const id = await managerIdForUser(viewer.id);
  const m = id ? await getManager(id) : null;
  if (!m) notFound();
  return <ManagerProfile manager={m} viewer={viewer} basePath="/manager/profile" tab={parseTab(sp.tab)} edit={false} locale={locale} />;
}
