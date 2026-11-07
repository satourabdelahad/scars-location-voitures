import { setRequestLocale } from "next-intl/server";
import { FleetListPage } from "@/features/fleet/pages";
import { requireRole } from "@/server/guards";

export default async function Page({ params, searchParams }: PageProps<"/[locale]/admin/fleet">) {
  const { locale } = await params;
  const { view } = await searchParams;
  setRequestLocale(locale);
  const user = await requireRole(["admin"]);
  return <FleetListPage base="/admin" userId={user.id} view={view === "calendar" ? "calendar" : "table"} />;
}
