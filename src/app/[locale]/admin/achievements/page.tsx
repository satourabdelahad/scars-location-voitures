import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { AchievementsPage } from "@/features/my/pages";

export default async function Page({ params }: PageProps<"/[locale]/admin/achievements">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole(["admin"], "/admin/achievements");
  return <AchievementsPage me={me} />;
}
