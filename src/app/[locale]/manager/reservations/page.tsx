import { setRequestLocale } from "next-intl/server";
import { ReservationsListPage } from "@/features/reservations/pages";
import { requireRole } from "@/server/guards";

export default async function Page({ params }: PageProps<"/[locale]/manager/reservations">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(["manager"]);
  return <ReservationsListPage base="/manager" userId={user.id} />;
}
