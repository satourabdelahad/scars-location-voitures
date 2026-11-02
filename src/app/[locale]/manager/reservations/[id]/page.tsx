import { setRequestLocale } from "next-intl/server";
import { ReservationDetailPage } from "@/features/reservations/pages";
import { requireRole } from "@/server/guards";

export default async function Page({ params }: PageProps<"/[locale]/manager/reservations/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole(["manager"]);
  return <ReservationDetailPage base="/manager" id={id} locale={locale} />;
}
