import { setRequestLocale } from "next-intl/server";
import { CarDetailPage } from "@/features/fleet/pages";
import { requireRole } from "@/server/guards";

export default async function Page({ params }: PageProps<"/[locale]/admin/fleet/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"]);
  return <CarDetailPage base="/admin" id={id} locale={locale} />;
}
