import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarCheck2, CalendarX2, DoorOpen, Fuel, Gauge, Luggage, MapPin, Snowflake, Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CarArt } from "@/components/car-art";
import { getBookedRanges, getPublicCar } from "@/server/queries/cars";
import { formatDate, formatMoney, todayISO } from "@/lib/utils";
import { activePromoPercent, promoPrice } from "@/lib/car-promo";

export async function generateMetadata({ params }: PageProps<"/[locale]/cars/[id]">) {
  const { locale, id } = await params;
  const car = await getPublicCar(id, locale);
  return { title: car ? `${car.brand} ${car.model}` : undefined };
}

export default async function CarPage({ params, searchParams }: PageProps<"/[locale]/cars/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const car = await getPublicCar(id, locale);
  if (!car) notFound();
  const [t, e, c, booked] = await Promise.all([getTranslations("Cars"), getTranslations("Enums"), getTranslations("Common"), getBookedRanges(car.id)]);

  const start = typeof sp.start === "string" ? sp.start : undefined;
  const end = typeof sp.end === "string" ? sp.end : undefined;
  const hasDates = Boolean(start && end && end > start);
  const conflict = hasDates && booked.some((b) => b.start < end! && b.end > start!);
  const promo = activePromoPercent(car, hasDates ? start! : todayISO());
  // Les choix de la recherche (agence, dates, heures) suivent jusqu'à la réservation.
  const carry = new URLSearchParams(
    Object.entries({ agency: sp.agency, start: sp.start, end: sp.end, startTime: sp.startTime, endTime: sp.endTime }).filter(([, v]) => typeof v === "string" && v) as [string, string][],
  ).toString();
  const bookHref = `/book/${car.id}${carry ? `?${carry}` : ""}`;

  const specs = [
    { icon: Users, label: t("seatsN", { count: car.seats }) },
    { icon: DoorOpen, label: t("doorsN", { count: car.doors }) },
    { icon: Luggage, label: t("luggageN", { count: car.luggage }) },
    { icon: Gauge, label: e(`transmission.${car.transmission}`) },
    { icon: Fuel, label: e(`fuel.${car.fuel}`) },
    ...(car.airConditioning ? [{ icon: Snowflake, label: t("airConditioning") }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link href="/cars" className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
      <div className="mt-4 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="relative aspect-[16/9] overflow-hidden rounded-[26px] bg-gradient-to-b from-paper to-mist/70">
            {car.images[0] ? (
              <Image src={car.images[0].url} alt={`${car.brand} ${car.model}`} fill priority sizes="(min-width:1024px) 60vw, 100vw" className="object-cover" />
            ) : (
              <CarArt category={car.category} color={car.colorHex} title={`${car.brand} ${car.model}`} className="absolute inset-x-[6%] bottom-[6%] w-[88%]" />
            )}
          </div>
          {car.images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {car.images.slice(1, 5).map((img) => (
                <div key={img.id} className="relative aspect-[4/3] overflow-hidden rounded-xl">
                  <Image src={img.url} alt="" fill sizes="15vw" className="object-cover" />
                </div>
              ))}
            </div>
          )}
          <section className="mt-10">
            <h2 className="text-xl font-bold text-ink">{t("specs")}</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {specs.map((s) => (
                <li key={s.label} className="flex items-center gap-3 rounded-xl border border-mist bg-paper px-4 py-3 text-sm font-medium text-ink-2">
                  <s.icon className="size-4 text-majorelle" aria-hidden />
                  {s.label}
                </li>
              ))}
            </ul>
          </section>
          {car.description && (
            <section className="mt-10">
              <h2 className="text-xl font-bold text-ink">{t("description")}</h2>
              <p className="mt-3 max-w-[68ch] leading-relaxed text-ink-2">{car.description}</p>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-[26px] border border-mist bg-paper p-6 lg:sticky lg:top-24">
          <p className="text-sm font-semibold text-ink-3">{e(`category.${car.category}`)}</p>
          <h1 className="display-md mt-1 text-3xl text-ink">{car.brand} {car.model}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-3">
            <MapPin className="size-4" aria-hidden />
            {car.agency.city}, {car.agency.name}
          </p>
          <p className="mt-6 tabular">
            {promo && <span className="me-2 text-lg text-ink-3 line-through">{formatMoney(car.dailyPrice, locale)}</span>}
            <span className={`text-4xl font-extrabold ${promo ? "text-saffron-ink" : "text-ink"}`} style={{ fontStretch: "115%" }}>{formatMoney(promoPrice(car.dailyPrice, promo), locale)}</span>
            <span className="ms-1.5 text-ink-3">{c("perDay")}</span>
          </p>
          {promo && (
            <p className="mt-2 inline-flex rounded-full bg-saffron px-3 py-1 text-xs font-extrabold text-[#141a2e]">
              -{promo} %{car.promoEndsOn ? ` · ${t("promoUntil", { date: formatDate(car.promoEndsOn, locale) })}` : ""}
            </p>
          )}
          <dl className="mt-5 space-y-2 border-t border-mist pt-5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-3">{t("year")}</dt><dd className="font-semibold text-ink">{car.year}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-3">{t("deposit")}</dt><dd className="font-semibold text-ink">{formatMoney(car.deposit, locale)}</dd></div>
          </dl>
          {hasDates && (
            <p className={`mt-5 flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm font-medium ${conflict ? "bg-danger-soft text-danger" : "bg-palm-soft text-palm"}`}>
              {conflict ? <CalendarX2 className="mt-0.5 size-4 shrink-0" /> : <CalendarCheck2 className="mt-0.5 size-4 shrink-0" />}
              <span>
                {conflict ? t("unavailable") : t("available")}
                <span className="block text-xs opacity-80">{formatDate(start, locale)} – {formatDate(end, locale)}</span>
              </span>
            </p>
          )}
          <Link href={bookHref} className="mt-6 flex h-13 items-center justify-center rounded-xl bg-majorelle py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-majorelle-deep dark:text-[#0f1322]">
            {t("book")}
          </Link>
        </aside>
      </div>
    </div>
  );
}
