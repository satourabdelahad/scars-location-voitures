import { CalendarCheck, CarFront, KeyRound, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/auth";
import { HeroSearch } from "@/components/hero-search";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Link } from "@/i18n/navigation";
import { activePromoPercent, promoPrice } from "@/lib/car-promo";
import { rentalDays, todayISO } from "@/lib/utils";
import { listPublicCars } from "@/server/queries/cars";
import { publicSite, waLink } from "@/server/public-site";
import { AvailableCars } from "./available-cars";

export async function generateMetadata({ params }: PageProps<"/[locale]/reservation">) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "Nav" }))("booking") };
}

const searchSchema = z.object({
  agency: z.coerce.number().int().positive(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().catch(undefined),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().catch(undefined),
});

/**
 * Réservation sans compte : lieu (agence), dates et heures, puis la liste des voitures disponibles
 * (nombre, tri par nom ou par prix, prix de la location, détails ou réserver).
 */
export default async function ReservationPage({ params, searchParams }: PageProps<"/[locale]/reservation">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = searchSchema.safeParse(raw);
  const q = parsed.success && parsed.data.start >= todayISO() && parsed.data.end > parsed.data.start ? parsed.data : null;
  const [t, { agencies, contact }, session] = await Promise.all([getTranslations("ReservationPage"), publicSite(), auth()]);
  const agency = q ? agencies.find((a) => a.id === q.agency) : undefined;
  const cars = q && agency ? await listPublicCars({ agencyId: q.agency, start: q.start, end: q.end, limit: 300 }) : null;
  const days = q ? rentalDays(q.start, q.end) : 0;
  const query = q ? new URLSearchParams(Object.entries({ agency: String(q.agency), start: q.start, end: q.end, startTime: q.startTime, endTime: q.endTime }).filter(([, v]) => v) as [string, string][]).toString() : "";
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
      <div className="mt-8">
        <HeroSearch
          agencies={agencies.map((a) => ({ id: a.id, city: a.city, name: a.name, address: a.address }))}
          locale={locale}
          initial={q ? { agency: q.agency, start: q.start, end: q.end, startTime: q.startTime, endTime: q.endTime } : {}}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {session?.user?.role === "client" && (
          <Link href="/account?tab=reservations" className="font-semibold text-majorelle hover:underline">{t("myBookings")}</Link>
        )}
        {contact.whatsapp && (
          <a href={waLink(contact.whatsapp)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold text-palm hover:underline">
            <WhatsAppIcon className="size-4" />
            {t("byWhatsapp")}
          </a>
        )}
      </div>

      {cars && agency && q ? (
        <section id="results" className="mt-12 scroll-mt-24" aria-label={t("resultsTitle")}>
          <AvailableCars
            locale={locale}
            days={days}
            query={query}
            place={`${agency.city} · ${agency.name}`}
            cars={cars.map((c) => {
              const promo = activePromoPercent(c, q.start);
              const perDay = promoPrice(c.dailyPrice, promo);
              return {
                id: c.id,
                name: `${c.brand} ${c.model}`,
                year: c.year,
                category: c.category,
                transmission: c.transmission,
                fuel: c.fuel,
                seats: c.seats,
                luggage: c.luggage,
                colorHex: c.colorHex,
                cover: c.cover,
                basePrice: c.dailyPrice,
                perDay,
                promo,
                total: perDay * days,
              };
            })}
          />
        </section>
      ) : (
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
      )}
    </div>
  );
}
