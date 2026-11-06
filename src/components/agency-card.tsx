import { Clock, Globe, MessageCircle, Phone, Plane } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SocialLinks } from "@/components/social-links";
import { waLink, type publicSite } from "@/server/public-site";

/** Carte d'une agence : adresse, horaires, site web, réseaux sociaux, WhatsApp et appel. */
type Agency = Awaited<ReturnType<typeof publicSite>>["agencies"][number];
export async function AgencyCard({ a }: { a: Agency }) {
  const t = await getTranslations("Contact");
  const wa = a.whatsapp || a.phone;
  return (
    <li className="flex flex-col rounded-[22px] border border-mist bg-paper p-6">
      <p className="display-md text-2xl text-ink">{a.city}</p>
      <p className="mt-1 flex items-center gap-2 font-semibold text-ink-2">
        {a.isAirport && <Plane className="size-4 text-majorelle" aria-label={t("airport")} />}
        {a.name}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-3">{a.address}</p>
      <p className="mt-3 flex items-center gap-2 text-sm text-ink-3"><Clock className="size-4" />{t("hours")}</p>
      {a.websiteUrl && (
        <a href={a.websiteUrl} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-majorelle hover:underline">
          <Globe className="size-4" />
          {a.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      )}
      <SocialLinks className="mt-4" links={{ facebook: a.facebookUrl, instagram: a.instagramUrl, linkedin: a.linkedinUrl, x: a.xUrl }} />
      {(wa || a.phone) && (
        <div className="mt-auto flex gap-2 pt-6">
          {wa && (
            <a href={waLink(wa)} target="_blank" rel="noopener" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-palm text-sm font-semibold text-white hover:brightness-110">
              <MessageCircle className="size-4" />{t("whatsapp")}
            </a>
          )}
          {a.phone && (
            <a href={`tel:${a.phone}`} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-mist-2 text-sm font-semibold text-ink hover:border-ink-3">
              <Phone className="size-4" />{t("call")}
            </a>
          )}
        </div>
      )}
    </li>
  );
}
