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
  const [agencies, cars] = await Promise.all([listAgencies(), listPublicCars(f)]);
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

      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <form method="get" className="h-fit rounded-[22px] border border-mist bg-paper p-5 lg:sticky lg:top-24" aria-label={t("filters")}>
          <p className="mb-4 flex items-center gap-2 font-bold text-ink">
            <SlidersHorizontal className="size-4" aria-hidden />
            {t("filters")}
          </p>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-ink-3">{t("city")}</span>
              <select name="city" defaultValue={f.city ?? ""} className={selectCls}>
                <option value="">{t("anyCity")}</option>
                {agencies.map((a) => (
                  <option key={a.slug} value={a.slug}>{a.city} : {a.name}</option>
                ))}
              </select>
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
              <CarArt category="economy" color="#cfd3e3" className="w-48" />
              <p className="mt-4 text-lg font-bold text-ink">{t("emptyTitle")}</p>
              <p className="mt-1 text-ink-3">{t("emptyBody")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
