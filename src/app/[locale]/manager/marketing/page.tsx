import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { MarketingPage } from "@/features/marketing/pages";

export default async function Page({ params }: PageProps<"/[locale]/manager/marketing">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["manager"], "/manager/marketing");
  return <MarketingPage />;
}
