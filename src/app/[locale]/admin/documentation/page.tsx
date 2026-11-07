import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { DocumentationPage } from "@/features/documentation/page";

export default async function Page({ params }: PageProps<"/[locale]/admin/documentation">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"], "/admin/documentation");
  return <DocumentationPage isAdmin />;
}
