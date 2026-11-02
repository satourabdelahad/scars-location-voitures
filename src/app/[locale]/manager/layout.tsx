import { setRequestLocale } from "next-intl/server";
import { BackofficeShell } from "@/components/backoffice/shell";
import { requireRole } from "@/server/guards";

export default async function ManagerLayout({ children, params }: LayoutProps<"/[locale]/manager">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(["manager"], "/manager");
  return <BackofficeShell user={user} base="/manager">{children}</BackofficeShell>;
}
