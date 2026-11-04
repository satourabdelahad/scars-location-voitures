import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { SelfProfilePage } from "@/features/profile/self-profile-page";

export default async function AdminProfilePage({ params }: PageProps<"/[locale]/admin/profile">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole(["admin"], "/admin/profile");
  return <SelfProfilePage me={me} />;
}
