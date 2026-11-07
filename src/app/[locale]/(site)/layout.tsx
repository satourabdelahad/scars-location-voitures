import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { TopBar } from "@/components/layout/top-bar";

export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <TopBar />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
