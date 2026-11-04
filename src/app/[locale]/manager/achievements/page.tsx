import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { AchievementsPage } from "@/features/my/pages";

export default async function Page({ params }: PageProps<"/[locale]/manager/achievements">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole(["manager"], "/manager/achievements");
  return <AchievementsPage me={me} />;
}
