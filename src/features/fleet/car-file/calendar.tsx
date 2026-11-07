"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Panel } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { intlLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { loadCalendar } from "@/server/actions/car-file";
import type { CalendarBooking } from "@/server/queries/car-file";

const STATUS_BG: Record<string, string> = {
  pending: "bg-saffron/80 text-ink",
  confirmed: "bg-majorelle text-white",
  ongoing: "bg-ink text-chalk",
  completed: "bg-palm/80 text-white",
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const daysIn = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

function useMonth(carId?: string) {
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [rows, setRows] = useState<CalendarBooking[] | null>(null);
  useEffect(() => {
    let alive = true;
    const from = iso(month);
    const to = iso(new Date(month.getFullYear(), month.getMonth(), daysIn(month)));
    loadCalendar(from, to, carId).then((r) => alive && setRows(r.ok ? r.data! : []));
    return () => {
      alive = false;
    };
  }, [month, carId]);
  return { month, setMonth, rows };
}

function MonthNav({ month, setMonth }: { month: Date; setMonth: (d: Date) => void }) {
  const t = useTranslations("Planning");
  const locale = useLocale();
  return (
    <div className="flex items-center gap-2">
      <Button size="icon" variant="outline" aria-label={t("prev")} onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="size-4 rtl:rotate-180" /></Button>
      <p className="min-w-40 text-center text-sm font-bold text-ink capitalize">{new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric" }).format(month)}</p>
      <Button size="icon" variant="outline" aria-label={t("next")} onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="size-4 rtl:rotate-180" /></Button>
      <Button size="sm" variant="ghost" onClick={() => setMonth(monthStart(new Date()))}>{t("today")}</Button>
    </div>
  );
}

function Legend() {
  const t = useTranslations("Planning");
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-3">
      {Object.entries(STATUS_BG).map(([s, cls]) => (
        <span key={s} className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-sm", cls)} />{t(`status.${s}`)}</span>
      ))}
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-mist-2 bg-paper" />{t("free")}</span>
    </div>
  );
}

/** Planning d'une voiture : un mois, chaque jour réservé coloré selon l'état de la réservation. */
export function CarCalendar({ carId, base }: { carId: string; base: string }) {
  const t = useTranslations("Planning");
  const locale = useLocale();
  const { month, setMonth, rows } = useMonth(carId);
  const n = daysIn(month);
  const lead = (month.getDay() + 6) % 7; // semaine du lundi
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short" }).format(new Date(2024, 0, 1 + i))), [locale]);
  const todayIso = iso(new Date());
  const on = (day: string) => rows?.find((b) => b.startDate <= day && b.endDate > day) ?? rows?.find((b) => b.endDate === day);
  const busy = rows ? new Set(Array.from({ length: n }, (_, i) => iso(new Date(month.getFullYear(), month.getMonth(), i + 1))).filter((d) => rows.some((b) => b.startDate <= d && b.endDate > d))).size : 0;

  return (
    <Panel className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MonthNav month={month} setMonth={setMonth} />
        <Badge tone="info">{t("occupancy", { percent: Math.round((busy / n) * 100) })}</Badge>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-3">
        {weekdays.map((w) => <div key={w} className="py-1 capitalize">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => <div key={`x${i}`} />)}
        {Array.from({ length: n }, (_, i) => {
          const day = iso(new Date(month.getFullYear(), month.getMonth(), i + 1));
          const b = on(day);
          const isStart = b?.startDate === day;
          const isReturn = b && b.endDate === day;
          return (
            <div
              key={day}
              className={cn(
                "relative min-h-16 rounded-lg border p-1.5 text-start text-xs",
                b && !isReturn ? cn(STATUS_BG[b.status], "border-transparent") : "border-mist bg-paper",
                day === todayIso && "ring-2 ring-majorelle ring-offset-1 ring-offset-paper",
              )}
            >
              <span className="font-semibold tabular">{i + 1}</span>
              {b && (isStart || isReturn) && (
                <Link href={`${base}/reservations/${b.id}`} className="mt-1 block truncate text-[11px] font-semibold underline-offset-2 hover:underline">
                  {isReturn ? `↩ ${b.reference}` : `${b.reference} · ${b.client}`}
                </Link>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4"><Legend /></div>
    </Panel>
  );
}

type FleetCar = { id: string; brand: string; model: string; plateNumber: string; status: string; city: string };

/** Planning du parc : une ligne par voiture, une colonne par jour du mois. */
export function FleetCalendar({ cars, base }: { cars: FleetCar[]; base: string }) {
  const t = useTranslations("Planning");
  const { month, setMonth, rows } = useMonth();
  const [q, setQ] = useState("");
  const n = daysIn(month);
  const days = Array.from({ length: n }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1));
  const todayIso = iso(new Date());
  const shown = cars.filter((c) => !q || `${c.brand} ${c.model} ${c.plateNumber} ${c.city}`.toLowerCase().includes(q.toLowerCase()));
  const byCar = useMemo(() => {
    const m = new Map<string, CalendarBooking[]>();
    for (const b of rows ?? []) m.set(b.carId, [...(m.get(b.carId) ?? []), b]);
    return m;
  }, [rows]);
  const first = iso(days[0]);
  const last = iso(days[n - 1]);

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist p-4">
        <MonthNav month={month} setMonth={setMonth} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchCar")}
          aria-label={t("searchCar")}
          className="h-9 w-56 rounded-lg border border-mist-2 bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink-3/70 focus:border-majorelle"
        />
      </div>
      <div className="scroll-thin overflow-x-auto">
        <div className="min-w-max">
          <div className="sticky top-0 z-10 flex border-b border-mist bg-chalk text-[11px] font-semibold text-ink-3">
            <div className="sticky start-0 z-10 w-56 shrink-0 border-e border-mist bg-chalk px-3 py-2">{t("car")}</div>
            {days.map((d) => (
              <div key={iso(d)} className={cn("w-9 shrink-0 py-2 text-center tabular", (d.getDay() === 0 || d.getDay() === 6) && "bg-mist/50", iso(d) === todayIso && "text-majorelle")}>
                {d.getDate()}
              </div>
            ))}
          </div>
          {shown.map((c) => {
            const list = byCar.get(c.id) ?? [];
            return (
              <div key={c.id} className="flex border-b border-mist last:border-0">
                <Link href={`${base}/fleet/${c.id}?tab=calendar`} className="sticky start-0 z-[5] flex w-56 shrink-0 flex-col justify-center border-e border-mist bg-paper px-3 py-2 hover:bg-chalk">
                  <span className="truncate text-[13px] font-semibold text-ink">{c.brand} {c.model}</span>
                  <span className="flex items-center gap-1.5 truncate text-[11px] text-ink-3" dir="ltr">
                    {c.plateNumber} · {c.city}
                    {c.status === "maintenance" && <Badge tone="warning" className="px-1.5 py-0 text-[10px]">{t("repair")}</Badge>}
                  </span>
                </Link>
                <div className="relative flex">
                  {days.map((d) => (
                    <div key={iso(d)} className={cn("h-12 w-9 shrink-0 border-e border-mist/60", (d.getDay() === 0 || d.getDay() === 6) && "bg-mist/30", c.status === "maintenance" && "bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(232,170,40,.18)_4px,rgba(232,170,40,.18)_8px)]")} />
                  ))}
                  {list.map((b) => {
                    const s = b.startDate < first ? first : b.startDate;
                    const e = b.endDate > last ? last : b.endDate;
                    const startIdx = Number(s.slice(8, 10)) - 1;
                    // Du jour de départ au jour de retour inclus, coupé aux bords du mois.
                    const span = Math.max(1, Number(e.slice(8, 10)) - startIdx);
                    return (
                      <Link
                        key={b.id}
                        href={`${base}/reservations/${b.id}`}
                        title={`${b.reference} · ${b.client} · ${b.startDate} → ${b.endDate}`}
                        className={cn("absolute top-2 h-8 truncate rounded-md px-1.5 text-[11px] leading-8 font-semibold shadow-sm hover:brightness-110", STATUS_BG[b.status])}
                        style={{ insetInlineStart: startIdx * 36 + 2, width: span * 36 - 4 }}
                      >
                        {b.client}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist p-4">
        <Legend />
        <span className="text-xs text-ink-3">{rows === null ? t("loading") : t("count", { cars: shown.length, bookings: rows.length })}</span>
      </div>
    </Panel>
  );
}
