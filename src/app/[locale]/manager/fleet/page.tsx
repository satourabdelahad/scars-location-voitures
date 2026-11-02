import { setRequestLocale } from "next-intl/server";
import { FleetListPage } from "@/features/fleet/pages";
import { requireRole } from "@/server/guards";

export default async function Page({ params }: PageProps<"/[locale]/manager/fleet">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(["manager"]);
  return <FleetListPage base="/manager" userId={user.id} />;
}
