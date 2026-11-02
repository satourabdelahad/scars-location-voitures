import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import type { SessionUser } from "@/server/guards";
import { SideNav, type NavItem } from "./side-nav";

export async function BackofficeShell({ user, base, children }: { user: SessionUser; base: "/admin" | "/manager"; children: ReactNode }) {
  const t = await getTranslations("Back");
  const n = await getTranslations("Nav");
  const items: NavItem[] = [
    { href: base, label: t("dashboard"), icon: "dashboard", exact: true },
    ...(base === "/admin" ? [{ href: `${base}/managers`, label: t("managers"), icon: "managers" as const }] : []),
    { href: `${base}/fleet`, label: t("fleet"), icon: "fleet" },
    { href: `${base}/reservations`, label: t("reservations"), icon: "reservations" },
  ];

  return (
    <div className="min-h-dvh bg-chalk lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-mist bg-paper px-4 py-5 lg:flex">
        <Link href={base} className="px-2"><Logo /></Link>
        <p className="mt-1 px-2 text-xs font-medium text-ink-3">{base === "/admin" ? n("adminSpace") : n("managerSpace")}</p>
        <SideNav items={items} />
        <Link href="/" className="mt-auto rounded-lg px-3 py-2 text-sm font-medium text-ink-3 hover:bg-chalk hover:text-ink">{t("viewSite")}</Link>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-mist bg-chalk/85 px-4 backdrop-blur-md sm:px-6">
          <div className="lg:hidden"><Link href={base}><Logo /></Link></div>
          <SideNav items={items} mobile />
          <div className="ms-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
          {/* La langue reste en haut à droite dans toutes les langues */}
          <div className="order-last rtl:order-first">
            <LanguageSwitcher />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
