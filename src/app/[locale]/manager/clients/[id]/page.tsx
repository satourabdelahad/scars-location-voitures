import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { ClientProfilePage, parseClientTab } from "@/features/clients/pages";

export default async function Page({ params, searchParams }: PageProps<"/[locale]/manager/clients/[id]">) {
  const [{ locale, id }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  await requireRole(["manager"], `/manager/clients/${id}`);
  return <ClientProfilePage base="/manager" id={id} tab={parseClientTab(sp.tab)} locale={locale} />;
}
