import { setRequestLocale } from "next-intl/server";
import { Dashboard } from "@/features/dashboard";
import { requireRole } from "@/server/guards";

export default async function Page({ params }: PageProps<"/[locale]/manager">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(["manager"]);
  return <Dashboard base="/manager" user={user} locale={locale} />;
}
