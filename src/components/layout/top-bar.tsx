import { Clock, Mail, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { publicSite, waLink } from "@/server/public-site";

/** Bandeau en haut du site public : disponibilité, email, téléphone et WhatsApp (réglés dans Site public). */
export async function TopBar() {
  const [{ contact }, t] = await Promise.all([publicSite(), getTranslations("TopBar")]);
  return (
    <div className="bg-ink text-chalk dark:bg-paper dark:text-ink">
      <div className="scroll-thin mx-auto flex h-9 max-w-7xl items-center gap-x-5 overflow-x-auto px-4 text-xs font-medium whitespace-nowrap sm:px-6">
        <span className="inline-flex items-center gap-1.5 text-saffron">
          <Clock className="size-3.5" />
          {t("always")}
        </span>
        <span className="flex-1" />
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
