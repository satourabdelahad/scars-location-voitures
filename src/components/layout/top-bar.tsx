import { Clock, Mail, Phone, Truck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { SocialLinks } from "@/components/social-links";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { defaultPageText } from "@/lib/site-page-defaults";
import { publicSite, waLink } from "@/server/public-site";
import { pageText } from "@/server/site-settings";

/**
 * Bandeau en haut du site public (réglé dans Site public) :
 * à gauche, ouverture 24h/24 · 7j/7 et la livraison gratuite ;
 * à droite, réseaux sociaux, email, téléphone et WhatsApp.
 */
/** wide : pleine largeur (back-office). */
export async function TopBar({ wide = false }: { wide?: boolean } = {}) {
  const [{ contact, settings }, t, locale] = await Promise.all([publicSite(), getTranslations("TopBar"), getLocale()]);
  const note = pageText(settings, "topbar_note", locale) ?? defaultPageText("topbar_note", locale);
  const c = settings.contact;
  return (
    <div data-topbar className="bg-ink text-chalk print:hidden dark:bg-paper dark:text-ink">
      <div className={`scroll-thin mx-auto flex h-9 items-center ${wide ? "" : "max-w-7xl "} gap-x-5 overflow-x-auto px-4 text-xs font-medium whitespace-nowrap sm:px-6`}>
        <span className="inline-flex items-center gap-1.5 text-saffron">
          <Clock className="size-3.5" />
          {t("always")}
        </span>
        {note && (
          <span className="hidden items-center gap-1.5 opacity-85 lg:inline-flex">
            <Truck className="size-3.5" />
            {note}
          </span>
        )}
        <span className="flex-1" />
        <SocialLinks tone="light" size="sm" className="hidden md:flex" links={{ facebook: c.facebook, instagram: c.instagram, x: c.x, tiktok: c.tiktok }} />
        {contact.email && (
          <a href={`mailto:${contact.email}`} aria-label={contact.email} className="inline-flex items-center gap-1.5 opacity-85 hover:opacity-100">
            <Mail className="size-3.5" />
            <span className="hidden md:inline">{contact.email}</span>
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone.replace(/\s/g, "")}`} dir="ltr" aria-label={contact.phone} className="inline-flex items-center gap-1.5 opacity-85 hover:opacity-100">
            <Phone className="size-3.5" />
            <span className="hidden md:inline">{contact.phone}</span>
          </a>
        )}
        {contact.whatsapp && (
          <a href={waLink(contact.whatsapp)} target="_blank" rel="noopener" dir="ltr" aria-label={`WhatsApp ${contact.whatsapp}`} className="inline-flex items-center gap-1.5 text-[#4fd1a5] hover:brightness-110">
            <WhatsAppIcon className="size-3.5" />
            {contact.whatsapp}
          </a>
        )}
      </div>
    </div>
  );
}
