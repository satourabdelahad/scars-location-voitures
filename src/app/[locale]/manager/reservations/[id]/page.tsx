import { setRequestLocale } from "next-intl/server";
import { ReservationDetailPage } from "@/features/reservations/pages";
import { requireRole } from "@/server/guards";

export default async function Page({ params, searchParams }: PageProps<"/[locale]/manager/reservations/[id]">) {
  const { locale, id } = await params;
  const { pickup, decide, extension } = await searchParams;
  setRequestLocale(locale);
  await requireRole(["manager"]);
  return <ReservationDetailPage base="/manager" id={id} locale={locale} openPickup={pickup === "1"} from={{ decide: typeof decide === "string" ? decide : undefined, extension: typeof extension === "string" ? extension : undefined }} />;
}
