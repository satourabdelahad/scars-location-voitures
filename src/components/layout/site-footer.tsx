import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { publicSite } from "@/server/public-site";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const n = await getTranslations("Nav");
  const { multiAgency, contact } = await publicSite();
  return (
    <footer className="mt-24 bg-asphalt text-white/80">
      {/* Marquage au sol : rappel discret de la ligne de route du haut de page */}
      <div className="h-1 bg-[repeating-linear-gradient(90deg,var(--saffron)_0_28px,transparent_28px_48px)] opacity-80" aria-hidden />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo inverted />
          <p className="mt-4 text-sm leading-relaxed text-white/65">{t("tagline")}</p>
          {contact.address && <p className="mt-4 text-sm text-white/65">{contact.address}</p>}
        </div>
        <nav aria-label={t("explore")}>
          <p className="mb-3 text-sm font-bold text-white">{t("explore")}</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/cars">{n("cars")}</Link></li>
            <li><Link className="hover:text-white" href="/reservation">{n("booking")}</Link></li>
            {multiAgency && <li><Link className="hover:text-white" href="/agencies">{n("agencies")}</Link></li>}
            <li><Link className="hover:text-white" href="/about">{n("about")}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t("help")}>
          <p className="mb-3 text-sm font-bold text-white">{t("help")}</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/contact">{n("contact")}</Link></li>
            <li><Link className="hover:text-white" href="/terms">{t("terms")}</Link></li>
            <li><Link className="hover:text-white" href="/privacy">{t("privacy")}</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/50 sm:px-6">{t("rights", { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
