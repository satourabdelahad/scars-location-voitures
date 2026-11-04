import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { MyCarsPage } from "@/features/my/pages";

export default async function Page({ params }: PageProps<"/[locale]/manager/my-cars">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole(["manager"], "/manager/my-cars");
  return <MyCarsPage me={me} />;
}
