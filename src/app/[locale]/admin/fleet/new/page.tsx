import { setRequestLocale } from "next-intl/server";
import { NewCarPage } from "@/features/fleet/pages";
import { requireRole } from "@/server/guards";

export default async function Page({ params }: PageProps<"/[locale]/admin/fleet/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"]);
  return <NewCarPage base="/admin" />;
}
