import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { AdminProfile, parseAdminTab } from "@/features/managers/admin-profile";

/** « Mon profil » de l'administrateur : même page que la fiche d'un gestionnaire. */
export default async function AdminProfilePage({ params, searchParams }: PageProps<"/[locale]/admin/profile">) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const me = await requireRole(["admin"], "/admin/profile");
  return <AdminProfile me={me} tab={parseAdminTab(sp.tab)} locale={locale} />;
}
