import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { DocumentationPage } from "@/features/documentation/page";

export default async function Page({ params }: PageProps<"/[locale]/manager/documentation">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["manager"], "/manager/documentation");
  return <DocumentationPage isAdmin={false} />;
}
