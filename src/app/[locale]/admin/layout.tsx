import { setRequestLocale } from "next-intl/server";
import { BackofficeShell } from "@/components/backoffice/shell";
import { requireRole } from "@/server/guards";

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(["admin"], "/admin");
  return <BackofficeShell user={user} base="/admin">{children}</BackofficeShell>;
}
