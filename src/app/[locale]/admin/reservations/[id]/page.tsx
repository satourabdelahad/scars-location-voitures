import { setRequestLocale } from "next-intl/server";
import { ReservationDetailPage } from "@/features/reservations/pages";
import { requireRole } from "@/server/guards";

export default async function Page({ params }: PageProps<"/[locale]/admin/reservations/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"]);
  return <ReservationDetailPage base="/admin" id={id} locale={locale} />;
}
