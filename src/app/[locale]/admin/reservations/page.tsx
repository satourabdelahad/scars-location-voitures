import { setRequestLocale } from "next-intl/server";
import { ReservationsListPage } from "@/features/reservations/pages";
import { requireRole } from "@/server/guards";

export default async function Page({ params }: PageProps<"/[locale]/admin/reservations">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(["admin"]);
  return <ReservationsListPage base="/admin" userId={user.id} />;
}
