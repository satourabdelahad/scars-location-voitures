import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { MarketingPage } from "@/features/marketing/pages";

export default async function Page({ params }: PageProps<"/[locale]/admin/marketing">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"], "/admin/marketing");
  return <MarketingPage />;
}
