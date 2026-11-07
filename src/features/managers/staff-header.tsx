import { CarFront, Clock, Handshake, Mail, MapPin, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { cn, formatDateTime } from "@/lib/utils";
import type { StaffSummary } from "@/server/queries/manager-profile";

/** Logo WhatsApp (bulle et combiné), en couleur courante. */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}

function Item({ icon, label, children, className }: { icon: ReactNode; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-start gap-2.5 rounded-xl border border-mist bg-paper px-3.5 py-2.5", className)}>
      <span className="mt-0.5 shrink-0 text-ink-3 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{label}</p>
        <div className="truncate text-sm font-semibold text-ink">{children}</div>
      </div>
    </div>
  );
}

/**
 * Résumé en haut de la fiche d'un gestionnaire ou de l'administrateur : en ligne, dernière connexion,
 * voitures affectées, ville(s), dernier deal conclu, email, WhatsApp et téléphone.
 */
export async function StaffHeader({
  summary: s,
  email,
  phone,
  whatsapp,
  locale,
  isAdminProfile = false,
}: {
  summary: StaffSummary;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  locale: string;
  /** Fiche de l'administrateur : il voit tout le parc */
  isAdminProfile?: boolean;
}) {
  const t = await getTranslations("Managers");
  const c = await getTranslations("Common");
  return (
    <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <Item icon={<span className={cn("block size-2.5 rounded-full", s.online ? "bg-palm shadow-[0_0_0_4px_rgba(16,150,90,.18)]" : "bg-mist-2")} />} label={t("presence")}>
        <span className={s.online ? "text-palm" : "text-ink-3"}>{s.online ? t("online") : t("offline")}</span>
      </Item>
      <Item icon={<Clock />} label={t("lastLogin")}>
        {s.lastLoginAt ? formatDateTime(s.lastLoginAt, locale) : c("never")}
      </Item>
      <Item icon={<CarFront />} label={t("assignedCount")}>
        {isAdminProfile ? t("wholeFleet", { count: s.fleetCount }) : s.carCount ? t("carsCount", { count: s.carCount }) : t("sharedOnly")}
      </Item>
      <Item icon={<MapPin />} label={t("assignedCity")}>
        {s.cities.length ? s.cities.join(", ") : <span className="font-normal text-ink-3">—</span>}
      </Item>
      <Item icon={<Handshake />} label={t("lastDeal")}>
        {s.lastDeal ? (
          <>
            {s.lastDeal.name} <span className="font-normal text-ink-3">· {formatDateTime(s.lastDeal.at, locale)}</span>
          </>
        ) : (
          <span className="font-normal text-ink-3">{t("noDealYet")}</span>
        )}
      </Item>
      <Item icon={<Mail />} label={t("email")}>
        {email ? (
          <a href={`mailto:${email}`} dir="ltr" className="hover:text-majorelle">{email}</a>
        ) : (
          "—"
        )}
      </Item>
      <Item icon={<WhatsAppIcon className="text-palm" />} label={t("whatsapp")}>
        {whatsapp ? (
          <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener" dir="ltr" className="tabular text-palm hover:underline">{whatsapp}</a>
        ) : (
          "—"
        )}
      </Item>
      <Item icon={<Phone />} label={t("phone")}>
        {phone ? (
          <a href={`tel:${phone}`} dir="ltr" className="tabular hover:text-majorelle">{phone}</a>
        ) : (
          "—"
        )}
      </Item>
    </div>
  );
}
