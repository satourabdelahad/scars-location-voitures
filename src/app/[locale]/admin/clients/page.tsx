import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { ClientsListPage } from "@/features/clients/pages";

export default async function Page({ params }: PageProps<"/[locale]/admin/clients">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"], "/admin/clients");
  return <ClientsListPage base="/admin" />;
}
