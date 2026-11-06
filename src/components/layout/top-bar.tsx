import { Mail, MessageCircle, Phone } from "lucide-react";
import { publicSite, waLink } from "@/server/public-site";

/** Bandeau en haut du site public : email, téléphone et WhatsApp (réglés dans Site public). */
export async function TopBar() {
  const { contact } = await publicSite();
  if (!contact.email && !contact.phone && !contact.whatsapp) return null;
  return (
    <div className="bg-ink text-chalk dark:bg-paper dark:text-ink">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center gap-x-5 overflow-x-auto px-4 text-xs font-medium sm:justify-end sm:px-6">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="hidden items-center gap-1.5 whitespace-nowrap opacity-85 hover:opacity-100 sm:inline-flex">
            <Mail className="size-3.5" />
            {contact.email}
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone.replace(/\s/g, "")}`} dir="ltr" className="inline-flex items-center gap-1.5 whitespace-nowrap opacity-85 hover:opacity-100">
            <Phone className="size-3.5" />
            {contact.phone}
          </a>
        )}
        {contact.whatsapp && (
          <a href={waLink(contact.whatsapp)} target="_blank" rel="noopener" dir="ltr" className="inline-flex items-center gap-1.5 whitespace-nowrap text-[#4fd1a5] hover:brightness-110">
            <MessageCircle className="size-3.5" />
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
