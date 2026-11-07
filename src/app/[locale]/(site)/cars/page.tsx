import { SlidersHorizontal } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { CarCard } from "@/components/car-card";
import { Link } from "@/i18n/navigation";
import { carCategoryEnum, fuelEnum, transmissionEnum } from "@/db/schema";
import { listAgencies, listPublicCars } from "@/server/queries/cars";
import { CarArt } from "@/components/car-art";

const filtersSchema = z.object({
  city: z.string().max(64).optional().catch(undefined),
  cityName: z.string().max(120).optional().catch(undefined),
  agency: z.coerce.number().int().positive().optional().catch(undefined),
  dispo: z.literal("1").optional().catch(undefined),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  category: z.enum(carCategoryEnum.enumValues).optional().catch(undefined),
  transmission: z.enum(transmissionEnum.enumValues).optional().catch(undefined),
  fuel: z.enum(fuelEnum.enumValues).optional().catch(undefined),
  seats: z.coerce.number().int().min(1).max(20).optional().catch(undefined),
  maxPrice: z.coerce.number().positive().optional().catch(undefined),
  sort: z.enum(["price_asc", "price_desc", "newest"]).optional().catch(undefined),
});

export async function generateMetadata({ params }: PageProps<"/[locale]/cars">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Cars" });
  return { title: t("title") };
}

export default async function CarsPage({ params, searchParams }: PageProps<"/[locale]/cars">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]));
  const f = filtersSchema.parse(raw);
  const t = await getTranslations("Cars");
  const e = await getTranslations("Enums");
  const [agencies, cars] = await Promise.all([listAgencies(), listPublicCars({ ...f, agencyId: f.agency, availableNow: f.dispo === "1" })]);
  const cityNames = [...new Set(agencies.map((a) => a.city))].sort((a, b) => a.localeCompare(b, "fr"));
  const carryQuery = new URLSearchParams(Object.entries({ start: f.start, end: f.end, city: f.city }).filter(([, v]) => v) as [string, string][]).toString();

  const selectCls = "h-11 w-full rounded-[10px] border border-mist-2 bg-paper px-3 text-sm text-ink outline-none focus:border-majorelle";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-md text-4xl text-ink sm:text-5xl">{t("title")}</h1>
          <p className="mt-2 text-ink-3" aria-live="polite">{t("subtitle", { count: cars.length })}</p>
        </div>
      </div>

      {typeof raw.promo === "string" && /^[A-Z0-9-]{3,32}$/.test(raw.promo) && (
        <p role="status" className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl bg-saffron/20 px-5 py-4 text-sm font-medium text-saffron-ink">
          <span dir="ltr" className="rounded-md bg-paper px-2 py-0.5 font-mono font-bold text-ink">{raw.promo}</span>
          {t("promoActivated")}
        </p>
      )}
      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <form method="get" className="h-fit rounded-[22px] border border-mist bg-paper p-5 lg:sticky lg:top-24" aria-label={t("filters")}>
          <p className="mb-4 flex items-center gap-2 font-bold text-ink">
            <SlidersHorizontal className="size-4" aria-hidden />
            {t("filters")}
          </p>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-ink-3">{t("city")}</span>
              <select name="cityName" defaultValue={f.cityName ?? agencies.find((a) => a.slug === f.city)?.city ?? ""} className={selectCls}>
                <option value="">{t("anyCity")}</option>
                {cityNames.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-ink-3">{t("agency")}</span>
              <select name="agency" defaultValue={f.agency ? String(f.agency) : ""} className={selectCls}>
                <option value="">{t("anyAgency")}</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>{a.city} : {a.name}</option>
                ))}
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-mist-2 px-3 py-2.5 text-sm font-medium text-ink">
              <input type="checkbox" name="dispo" value="1" defaultChecked={f.dispo === "1"} className="size-4 accent-[var(--palm)]" />
              {t("availableNowFilter")}
            </label>
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 block text-xs font-semibold text-ink-3">{t("dates")}</legend>
              <input type="date" name="start" defaultValue={f.start} className={selectCls} aria-label={t("dates")} />
              <input type="date" name="end" defaultValue={f.end} className={selectCls} aria-label={t("dates")} />
            </fieldset>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-ink-3">{t("category")}</span>
              <select name="category" defaultValue={f.category ?? ""} className={selectCls}>
                <option value="">—</option>
                {carCategoryEnum.enumValues.map((c) => <option key={c} value={c}>{e(`category.${c}`)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-ink-3">{t("transmission")}</span>
              <select name="transmission" defaultValue={f.transmission ?? ""} className={selectCls}>
                <option value="">—</option>
                {transmissionEnum.enumValues.map((c) => <option key={c} value={c}>{e(`transmission.${c}`)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-ink-3">{t("fuel")}</span>
              <select name="fuel" defaultValue={f.fuel ?? ""} className={selectCls}>
                <option value="">—</option>
                {fuelEnum.enumValues.map((c) => <option key={c} value={c}>{e(`fuel.${c}`)}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-3">{t("seats")}</span>
                <input type="number" name="seats" min={1} max={9} defaultValue={f.seats} className={selectCls} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-3">{t("maxPrice")}</span>
                <input type="number" name="maxPrice" min={0} step={50} defaultValue={f.maxPrice} className={selectCls} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-ink-3">{t("sort")}</span>
              <select name="sort" defaultValue={f.sort ?? "price_asc"} className={selectCls}>
                <option value="price_asc">{t("sortPriceAsc")}</option>
                <option value="price_desc">{t("sortPriceDesc")}</option>
                <option value="newest">{t("sortNewest")}</option>
              </select>
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <button type="submit" className="h-11 flex-1 rounded-[10px] bg-majorelle font-semibold text-white hover:bg-majorelle-deep dark:text-[#0f1322]">{t("apply")}</button>
            <Link href="/cars" className="grid h-11 place-items-center rounded-[10px] border border-mist-2 px-4 text-sm font-semibold text-ink-2 hover:border-ink-3">{t("reset")}</Link>
          </div>
        </form>

        <section aria-label={t("title")}>
          {cars.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {cars.map((car) => <CarCard key={car.id} car={car} locale={locale} query={carryQuery} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-[22px] border border-dashed border-mist-2 px-6 py-16 text-center">
              <CarArt category="city_car" color="#cfd3e3" className="w-48" />
              <p className="mt-4 text-lg font-bold text-ink">{t("emptyTitle")}</p>
              <p className="mt-1 text-ink-3">{t("emptyBody")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
