import { setRequestLocale } from "next-intl/server";
import { CarDetailPage } from "@/features/fleet/pages";
import { requireRole } from "@/server/guards";

export default async function Page({ params }: PageProps<"/[locale]/manager/fleet/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole(["manager"]);
  return <CarDetailPage base="/manager" id={id} locale={locale} />;
}
