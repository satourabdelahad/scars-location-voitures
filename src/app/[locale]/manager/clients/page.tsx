import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { ClientsListPage } from "@/features/clients/pages";

export default async function Page({ params }: PageProps<"/[locale]/manager/clients">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["manager"], "/manager/clients");
  return <ClientsListPage base="/manager" />;
}
