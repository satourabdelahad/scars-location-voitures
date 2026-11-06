import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { publicSite } from "@/server/public-site";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  const [session, { multiAgency }] = await Promise.all([auth(), publicSite()]);
  // « Agences » seulement s'il y en a plusieurs ; sinon tout est sur la page Contact.
  const links = [
    { href: "/cars", label: t("cars") },
    ...(multiAgency ? [{ href: "/agencies", label: t("agencies") }] : []),
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-mist/80 bg-chalk/85 backdrop-blur-md supports-[backdrop-filter]:bg-chalk/70">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-chalk">
        {t("skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 sm:gap-5 px-4 sm:px-6">
        <Link href="/" aria-label="Dizy Cars" className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label={t("menu")}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-mist hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:grid" />
          {session?.user ? (
            <UserMenu user={session.user} />
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden h-10 rounded-full px-4 sm:inline-flex">
              <Link href="/login">{t("login")}</Link>
            </Button>
          )}
          <MobileNav links={links} loggedIn={Boolean(session?.user)} loginLabel={t("login")} menuLabel={t("menu")} />
        </div>
        {/* La langue reste en haut à droite, y compris en arabe et en darija. */}
        <div className="order-last rtl:order-first">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
