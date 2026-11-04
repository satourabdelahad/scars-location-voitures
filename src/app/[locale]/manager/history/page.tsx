import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { HistoryPage } from "@/features/my/pages";

export default async function Page({ params }: PageProps<"/[locale]/manager/history">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole(["manager"], "/manager/history");
  return <HistoryPage me={me} />;
}
