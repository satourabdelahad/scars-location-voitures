import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { AppointmentsPage } from "@/features/my/pages";

export default async function Page({ params }: PageProps<"/[locale]/manager/appointments">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole(["manager"], "/manager/appointments");
  return <AppointmentsPage me={me} />;
}
