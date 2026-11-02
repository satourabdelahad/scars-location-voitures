import { setRequestLocale } from "next-intl/server";
import { Dashboard } from "@/features/dashboard";
import { requireRole } from "@/server/guards";

export default async function Page({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(["admin"]);
  return <Dashboard base="/admin" user={user} locale={locale} />;
}
