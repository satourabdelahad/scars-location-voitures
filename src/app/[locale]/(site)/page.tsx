import { CheckCircle2, MessageCircle } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CarArt, DrivingCar } from "@/components/car-art";
import { Scenery } from "@/components/scenery";
import { CarCard } from "@/components/car-card";
import { HeroSearch } from "@/components/hero-search";
import { listAgencies, listPublicCars } from "@/server/queries/cars";
import { carCategoryEnum } from "@/db/schema";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const e = await getTranslations("Enums");
  const tc = await getTranslations("Common");
  const [agencies, cars] = await Promise.all([listAgencies(), listPublicCars({ sort: "newest", limit: 6 })]);
  const cities = Array.from(new Map(agencies.map((a) => [a.city, a])).values());

  return (
    <>
      {/* ── Hero : le titre, la voiture qui arrive, la route qui se trace ── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-end gap-6 px-4 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr]">
          <div className="relative z-10 pb-10 lg:pb-14">
            <h1 className="display max-w-[11ch] text-[clamp(2.9rem,7.4vw,6.2rem)] text-ink">{t("heroTitle")}</h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-ink-2">{t("heroSubtitle")}</p>
          </div>
          <div className="relative z-10 -mb-[4.6%] hidden w-full max-w-[680px] justify-self-end lg:block" aria-hidden>
            <Scenery className="absolute -inset-x-[30%] bottom-[7%] h-[62%] [mask-image:linear-gradient(90deg,transparent,#000_18%,#000_82%,transparent)]" />
            <DrivingCar category="suv_4x4" color="#4b3fd8" messages={[tc("hello"), tc("welcome"), tc("mission")]} className="car-arrive" />
          </div>
        </div>

        {/* La route : la voiture y est posée, la ligne se trace au chargement, la recherche y prend place */}
        <div className="relative h-[92px] bg-asphalt md:h-[112px]" aria-hidden>
          <svg className="absolute inset-x-0 top-[38%] h-2 w-full" preserveAspectRatio="none" viewBox="0 0 1200 8">
            <line x1="0" y1="4" x2="1200" y2="4" stroke="var(--saffron)" strokeWidth="5" strokeDasharray="44 30" className="lane-run" />
          </svg>
        </div>
        <div className="relative mx-auto -mt-10 max-w-7xl px-4 sm:px-6 md:-mt-12">
          <HeroSearch agencies={cities} locale={locale} />
          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-ink-2">
            {[t("trust1"), t("trust2"), t("trust3")].map((x) => (
              <li key={x} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-palm" aria-hidden />
                {x}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Le parc ── */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6" aria-labelledby="fleet-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="fleet-title" className="display-md text-3xl text-ink sm:text-4xl">{t("fleetTitle")}</h2>
            <p className="mt-2 text-ink-3">{t("fleetSubtitle")}</p>
          </div>
          <Link href="/cars" className="rounded-full border border-mist-2 px-4 py-2 text-sm font-semibold text-ink hover:border-ink-3">
            {t("seeAll")}
          </Link>
        </div>
        <div className="scroll-thin -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {carCategoryEnum.enumValues.map((c) => (
            <Link key={c} href={`/cars?category=${c}`} className="flex shrink-0 items-center gap-2 rounded-full border border-mist bg-paper py-1.5 ps-1.5 pe-4 text-sm font-medium text-ink-2 transition-colors hover:border-majorelle hover:text-ink">
              <span className="grid h-7 w-12 place-items-center rounded-full bg-chalk">
                <CarArt category={c} color="#6b7390" className="h-5 w-11" />
              </span>
              {e(`category.${c}`)}
            </Link>
          ))}
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((car) => (
            <CarCard key={car.id} car={car} locale={locale} />
          ))}
        </div>
      </section>

      {/* ── Trois étapes (une vraie séquence) ── */}
      <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6" aria-labelledby="steps-title">
        <h2 id="steps-title" className="display-md text-3xl text-ink sm:text-4xl">{t("stepsTitle")}</h2>
        <ol className="mt-8 grid gap-0 overflow-hidden rounded-[22px] border border-mist bg-paper md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <li key={n} className="relative border-mist p-7 not-last:border-b md:not-last:border-e md:not-last:border-b-0">
              <span className="display text-5xl text-majorelle/25 tabular">{n}</span>
              <h3 className="mt-3 text-xl font-bold text-ink">{t(`step${n}Title`)}</h3>
              <p className="mt-2 leading-relaxed text-ink-3">{t(`step${n}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Villes ── */}
      <section className="mt-24 bg-ink py-16 text-chalk dark:bg-paper" aria-labelledby="cities-title">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 id="cities-title" className="display-md text-3xl sm:text-4xl">{t("citiesTitle")}</h2>
            <p className="mt-3 max-w-md text-chalk/70">{t("citiesBody")}</p>
          </div>
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-3">
            {cities.map((a) => (
              <li key={a.slug}>
                <Link href={`/cars?city=${a.slug}`} className="flex h-full flex-col justify-between gap-6 bg-ink p-5 transition-colors hover:bg-[#1d2440] dark:bg-paper dark:hover:bg-mist">
                  <span className="display-md text-xl">{a.city}</span>
                  <span className="text-xs text-chalk/55">{a.isAirport ? "✈ " : ""}{a.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── WhatsApp ── */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[22px] border border-mist bg-paper p-8 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold text-ink">{t("ctaTitle")}</h2>
            <p className="mt-1.5 text-ink-3">{t("ctaBody")}</p>
          </div>
          <a href="https://wa.me/212600000000" target="_blank" rel="noopener" className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-palm px-6 font-bold text-white hover:brightness-110">
            <MessageCircle className="size-5" aria-hidden />
            {t("ctaButton")}
          </a>
        </div>
      </section>
    </>
  );
}
