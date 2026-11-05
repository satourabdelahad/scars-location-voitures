import Image from "next/image";
import { BadgeDollarSign, CalendarCheck, CalendarClock, CircleDollarSign, Gauge, KeyRound, MapPin, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { CarArt } from "@/components/car-art";
import { Badge, Panel } from "@/components/ui/misc";
import type { CarCategory } from "@/db/schema";
import { carState, STATE_TONE } from "@/lib/car-state";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import type { CarSummary } from "@/server/queries/fleet";

function Item({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-mist bg-paper px-3.5 py-2.5">
      <span className="mt-0.5 shrink-0 text-ink-3 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{label}</p>
        <div className="truncate text-sm font-semibold text-ink">{children}</div>
      </div>
    </div>
  );
}

/**
 * En-tête de la fiche voiture, comme celle d'un gestionnaire : marque, modèle et année,
 * dernière location (jour, heure, client), prix par jour, gain cumulé et ville.
 */
export async function CarHeader({
  car,
  summary: s,
  onRoad,
  locale,
  actions,
}: {
  car: { brand: string; model: string; year: number; plateNumber: string; category: CarCategory; colorHex: string; dailyPrice: number; status: string; cover: string | null; city: string; agency: string };
  summary: CarSummary;
  onRoad: boolean;
  locale: string;
  actions?: ReactNode;
}) {
  const t = await getTranslations("Fleet");
  const state = carState({ status: car.status, onRoad });
  return (
    <>
      <div className="mt-3 mb-5 flex flex-wrap items-center gap-4">
        <span className="relative grid h-16 w-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-chalk">
          {car.cover ? <Image src={car.cover} alt="" fill sizes="112px" className="object-cover" /> : <CarArt category={car.category} color={car.colorHex} className="w-24" />}
        </span>
        <div className="min-w-[min(100%,14rem)] flex-1">
          <h1 className="display-md text-2xl text-ink sm:text-3xl">
            {car.brand} {car.model} <span className="text-ink-3">{car.year}</span>
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={STATE_TONE[state]} dot>{t(`state.${state}`)}</Badge>
            <span dir="ltr" className="rounded-md border border-mist-2 bg-chalk px-2 py-0.5 font-mono text-xs text-ink">{car.plateNumber}</span>
          </div>
        </div>
        {actions}
      </div>
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Item icon={<CalendarCheck />} label={t("lastRental")}>
          {s.last ? (
            <>
              {s.last.at ? formatDateTime(s.last.at, locale) : formatDate(s.last.start, locale)} <span className="font-normal text-ink-3">· {s.last.client}</span>
            </>
          ) : (
            <span className="font-normal text-ink-3">{t("neverRented")}</span>
          )}
        </Item>
        <Item icon={<BadgeDollarSign />} label={t("dailyPrice")}>{formatMoney(car.dailyPrice, locale)}</Item>
        <Item icon={<TrendingUp />} label={t("totalRevenue")}>{formatMoney(s.revenue, locale)}</Item>
        <Item icon={<MapPin />} label={t("city")}>
          {car.city} <span className="font-normal text-ink-3">· {car.agency}</span>
        </Item>
      </div>
    </>
  );
}

/** Onglet « Statistiques » de la voiture. */
export async function CarStats({ summary: s, locale }: { summary: CarSummary; locale: string }) {
  const t = await getTranslations("Fleet");
  const tiles = [
    { icon: <KeyRound />, label: t("statRentals"), value: String(s.rentals) },
    { icon: <CalendarClock />, label: t("statDays"), value: String(s.days) },
    { icon: <TrendingUp />, label: t("totalRevenue"), value: formatMoney(s.revenue, locale) },
    { icon: <CircleDollarSign />, label: t("statAverage"), value: formatMoney(s.averageRental, locale) },
    { icon: <Gauge />, label: t("statOccupancy"), value: `${s.occupancy} %` },
    { icon: <CalendarCheck />, label: t("nextBooking"), value: s.nextStart ? formatDate(s.nextStart, locale) : t("free") },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {tiles.map((x) => (
        <Panel key={x.label} className="p-5">
          <p className="flex items-center gap-2 text-xs font-medium text-ink-3 [&_svg]:size-4">
            {x.icon}
            {x.label}
          </p>
          <p className="mt-2 text-2xl font-extrabold text-ink tabular" style={{ fontStretch: "112%" }}>{x.value}</p>
        </Panel>
      ))}
    </div>
  );
}
