import { setRequestLocale } from "next-intl/server";
import { ReservationDetailPage } from "@/features/reservations/pages";
import { requireRole } from "@/server/guards";

export default async function Page({ params, searchParams }: PageProps<"/[locale]/admin/reservations/[id]">) {
  const { locale, id } = await params;
  const { pickup } = await searchParams;
  setRequestLocale(locale);
  await requireRole(["admin"]);
  return <ReservationDetailPage base="/admin" id={id} locale={locale} openPickup={pickup === "1"} />;
}
