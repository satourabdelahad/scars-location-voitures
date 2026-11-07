import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { NewClientPage } from "@/features/clients/pages";

export default async function Page({ params }: PageProps<"/[locale]/manager/clients/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["manager"], "/manager/clients/new");
  return <NewClientPage base="/manager" />;
}
