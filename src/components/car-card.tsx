import Image from "next/image";
import { Fuel, Gauge, MapPin, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CarArt } from "@/components/car-art";
import { formatMoney } from "@/lib/utils";
import type { PublicCar } from "@/server/queries/cars";

export async function CarCard({ car, locale, query }: { car: PublicCar; locale: string; query?: string }) {
  const t = await getTranslations("Cars");
  const e = await getTranslations("Enums");
  const c = await getTranslations("Common");
  const href = `/cars/${car.id}${query ? `?${query}` : ""}`;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[22px] border border-mist bg-paper transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-mist-2">
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-b from-chalk to-mist/60">
        {car.cover ? (
          <Image src={car.cover} alt={`${car.brand} ${car.model}`} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <CarArt category={car.category} color={car.colorHex} className="absolute inset-x-4 bottom-2 h-[78%] w-[calc(100%-2rem)] transition-transform duration-500 group-hover:translate-x-1.5 rtl:group-hover:-translate-x-1.5" />
        )}
        <span className="absolute start-3 top-3 rounded-full bg-paper/90 px-2.5 py-1 text-xs font-semibold text-ink-2 backdrop-blur">
          {e(`category.${car.category}`)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold text-ink">
          <Link href={href} className="after:absolute after:inset-0">
            {car.brand} {car.model}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-3">
          <MapPin className="size-3.5" aria-hidden />
          {car.city}
          <span className="ms-auto tabular">{car.year}</span>
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
          <li className="flex items-center gap-1.5"><Users className="size-3.5 text-ink-3" />{t("seatsN", { count: car.seats })}</li>
          <li className="flex items-center gap-1.5"><Gauge className="size-3.5 text-ink-3" />{e(`transmission.${car.transmission}`)}</li>
          <li className="flex items-center gap-1.5"><Fuel className="size-3.5 text-ink-3" />{e(`fuel.${car.fuel}`)}</li>
        </ul>
        <div className="mt-auto flex items-end justify-between pt-5">
          <p className="tabular">
            <span className="text-2xl font-extrabold text-ink" style={{ fontStretch: "112%" }}>{formatMoney(car.dailyPrice, locale)}</span>
            <span className="ms-1 text-sm text-ink-3">{c("perDay")}</span>
          </p>
          <span className="rounded-full bg-saffron px-3 py-1.5 text-xs font-bold text-[#141a2e] transition-transform group-hover:scale-105">{t("book")}</span>
        </div>
      </div>
    </article>
  );
}
