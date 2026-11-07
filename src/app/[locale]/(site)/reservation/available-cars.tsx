"use client";

import Image from "next/image";
import { ArrowDownUp, Briefcase, Eye, Fuel, Gauge, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { CarArt } from "@/components/car-art";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { CarCategory } from "@/db/schema";
import { formatMoney } from "@/lib/utils";

type Car = {
  id: string;
  name: string;
  year: number;
  category: CarCategory;
  transmission: string;
  fuel: string;
  seats: number;
  luggage: number;
  colorHex: string;
  cover: string | null;
  basePrice: number;
  perDay: number;
  promo: number | null;
  total: number;
};
type Sort = "price_asc" | "price_desc" | "name_asc" | "name_desc";

/** Voitures libres sur la période, au lieu choisi : nombre en haut, tri par nom ou par prix, détails ou réserver. */
export function AvailableCars({ cars, days, query, place, locale }: { cars: Car[]; days: number; query: string; place: string; locale: string }) {
  const t = useTranslations("ReservationPage");
  const e = useTranslations("Enums");
  const tc = useTranslations("Common");
  const [sort, setSort] = useState<Sort>("price_asc");
  const sorted = useMemo(() => {
    const list = [...cars];
    const by = {
      price_asc: (a: Car, b: Car) => a.total - b.total,
      price_desc: (a: Car, b: Car) => b.total - a.total,
      name_asc: (a: Car, b: Car) => a.name.localeCompare(b.name, locale),
      name_desc: (a: Car, b: Car) => b.name.localeCompare(a.name, locale),
    }[sort];
    return list.sort(by);
  }, [cars, sort, locale]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-mist pb-5">
        <div>
          <h2 className="display-md text-3xl text-ink" aria-live="polite">{t("resultsCount", { count: cars.length })}</h2>
          <p className="mt-1 text-sm text-ink-3">{t("resultsFor", { place, days })}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-2">
          <ArrowDownUp className="size-4" />
          {t("sortBy")}
          <select value={sort} onChange={(x) => setSort(x.target.value as Sort)} className="h-10 rounded-[10px] border border-mist-2 bg-paper px-3 text-sm text-ink outline-none focus:border-majorelle">
            <option value="price_asc">{t("sortPriceAsc")}</option>
            <option value="price_desc">{t("sortPriceDesc")}</option>
            <option value="name_asc">{t("sortNameAsc")}</option>
            <option value="name_desc">{t("sortNameDesc")}</option>
          </select>
        </label>
      </div>
      {sorted.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-[22px] border border-dashed border-mist-2 px-6 py-16 text-center">
          <CarArt category="city_car" color="#cfd3e3" className="w-48" />
          <p className="mt-4 text-lg font-bold text-ink">{t("noneTitle")}</p>
          <p className="mt-1 text-ink-3">{t("noneBody")}</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4">
          {sorted.map((c) => (
            <li key={c.id} className="grid overflow-hidden rounded-[22px] border border-mist bg-paper sm:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr_240px]">
              <div className="relative aspect-[16/10] bg-gradient-to-b from-chalk to-mist/60 sm:aspect-auto sm:min-h-44">
                {c.cover ? (
                  <Image src={c.cover} alt={c.name} fill sizes="300px" className="object-cover" />
                ) : (
                  <CarArt category={c.category} color={c.colorHex} className="absolute inset-x-4 bottom-3 w-[calc(100%-2rem)]" />
                )}
                {c.promo && <span className="absolute end-3 top-3 rounded-full bg-saffron px-2.5 py-1 text-xs font-extrabold text-[#141a2e]">-{c.promo} %</span>}
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold text-ink-3">{e(`category.${c.category}`)}</p>
                <h3 className="mt-1 text-xl font-extrabold text-ink">{c.name} <span className="font-semibold text-ink-3">{c.year}</span></h3>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-2">
                  <li className="inline-flex items-center gap-1.5"><Users className="size-4 text-ink-3" />{t("seats", { count: c.seats })}</li>
                  <li className="inline-flex items-center gap-1.5"><Gauge className="size-4 text-ink-3" />{e(`transmission.${c.transmission}`)}</li>
                  <li className="inline-flex items-center gap-1.5"><Fuel className="size-4 text-ink-3" />{e(`fuel.${c.fuel}`)}</li>
                  <li className="inline-flex items-center gap-1.5"><Briefcase className="size-4 text-ink-3" />{t("bags", { count: c.luggage })}</li>
                </ul>
              </div>
              <div className="flex flex-col justify-between gap-4 border-t border-mist p-5 sm:col-span-2 lg:col-span-1 lg:border-s lg:border-t-0">
                <div>
                  <p className="text-2xl font-extrabold text-ink tabular" style={{ fontStretch: "112%" }}>{formatMoney(c.total, locale)}</p>
                  <p className="text-sm text-ink-3 tabular">
                    {c.promo && <span className="me-1.5 line-through">{formatMoney(c.basePrice, locale)}</span>}
                    {formatMoney(c.perDay, locale)} {tc("perDay")} · {tc("days", { count: days })}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Button asChild>
                    <Link href={`/book/${c.id}?${query}`}>{t("bookThis")}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/cars/${c.id}?${query}`}><Eye />{t("allDetails")}</Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
