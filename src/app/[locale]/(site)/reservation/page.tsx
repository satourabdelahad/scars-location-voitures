import { CalendarCheck, CarFront, KeyRound, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { HeroSearch } from "@/components/hero-search";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Link } from "@/i18n/navigation";
import { publicSite, waLink } from "@/server/public-site";

export async function generateMetadata({ params }: PageProps<"/[locale]/reservation">) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "Nav" }))("booking") };
}

/** Réservation : recherche (dates, ville) puis choix de la voiture ; les étapes et l'aide WhatsApp. */
export default async function ReservationPage({ params }: PageProps<"/[locale]/reservation">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, { agencies, contact }, session] = await Promise.all([getTranslations("ReservationPage"), publicSite(), auth()]);
  const cities = Array.from(new Map(agencies.map((a) => [a.city, a])).values());
  const steps = [
    { Icon: CalendarCheck, title: t("step1"), body: t("step1Body") },
    { Icon: CarFront, title: t("step2"), body: t("step2Body") },
    { Icon: ShieldCheck, title: t("step3"), body: t("step3Body") },
    { Icon: KeyRound, title: t("step4"), body: t("step4Body") },
  ];
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h1 className="display-md text-4xl text-ink sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-ink-3">{t("subtitle")}</p>
      <div className="mt-8 max-w-4xl">
        <HeroSearch agencies={cities} locale={locale} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {session?.user?.role === "client" && (
          <Link href="/account" className="font-semibold text-majorelle hover:underline">{t("myBookings")}</Link>
        )}
        {contact.whatsapp && (
          <a href={waLink(contact.whatsapp)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold text-palm hover:underline">
            <WhatsAppIcon className="size-4" />
            {t("byWhatsapp")}
          </a>
        )}
      </div>
      <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(({ Icon, title, body }, i) => (
          <li key={title} className="rounded-[22px] border border-mist bg-paper p-6">
            <span className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-majorelle-soft text-majorelle"><Icon className="size-5" /></span>
              <span className="text-xs font-semibold text-ink-3 tabular">{String(i + 1).padStart(2, "0")}</span>
            </span>
            <h2 className="mt-4 font-bold text-ink">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
