import { setRequestLocale } from "next-intl/server";
import { CarDetailPage } from "@/features/fleet/pages";
import { requireRole } from "@/server/guards";

export default async function Page({ params, searchParams }: PageProps<"/[locale]/manager/fleet/[id]">) {
  const { locale, id } = await params;
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  setRequestLocale(locale);
  await requireRole(["manager"]);
  return <CarDetailPage base="/manager" id={id} locale={locale} query={{ tab: one(q.tab), new: one(q.new), reservation: one(q.reservation) }} />;
}
