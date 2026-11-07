"use client";

import { CalendarDays, Clock, MapPin, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn, todayISO } from "@/lib/utils";

export type SearchAgency = { id: number; city: string; name: string; address: string };
export type SearchValues = { agency?: number; start?: string; startTime?: string; end?: string; endTime?: string };

/**
 * Recherche d'une voiture : lieu de prise en charge (agence, avec son adresse), date et heure de départ, date et heure
 * de retour. Le lieu et les dates sont obligatoires, les heures facultatives. Mène à la liste des voitures disponibles.
 */
export function HeroSearch({ agencies, locale, initial = {}, compact = false }: { agencies: SearchAgency[]; locale: string; initial?: SearchValues; compact?: boolean }) {
  const t = useTranslations("Home");
  const router = useRouter();
  const [agency, setAgency] = useState(initial.agency ? String(initial.agency) : agencies.length === 1 ? String(agencies[0].id) : "");
  const [start, setStart] = useState(initial.start ?? todayISO(1));
  const [startTime, setStartTime] = useState(initial.startTime ?? "");
  const [end, setEnd] = useState(initial.end ?? todayISO(4));
  const [endTime, setEndTime] = useState(initial.endTime ?? "");
  const [missing, setMissing] = useState(false);
  const byCity = Array.from(
    agencies.reduce((m, a) => m.set(a.city, [...(m.get(a.city) ?? []), a]), new Map<string, SearchAgency[]>()),
  ).sort(([x], [y]) => x.localeCompare(y, locale));
  const chosen = agencies.find((a) => String(a.id) === agency);

  const cell = "flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-colors focus-within:bg-chalk hover:bg-chalk";
  const label = "text-xs font-semibold text-ink-3";
  const input = "w-full min-w-0 bg-transparent text-[15px] font-semibold text-ink outline-none";

  return (
    <form
      action={`/${locale}/reservation`}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        if (!agency || !start || !end) return setMissing(true);
        const qs = new URLSearchParams({ agency, start, end });
        if (startTime) qs.set("startTime", startTime);
        if (endTime) qs.set("endTime", endTime);
        router.push(`/reservation?${qs.toString()}#results`);
      }}
      className={cn(
        "grid gap-1 rounded-[22px] border border-mist bg-paper p-2 shadow-[0_30px_70px_-30px_rgba(20,26,46,.45)]",
        compact ? "lg:grid-cols-[1.4fr_1fr_1fr_auto]" : "md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]",
      )}
    >
      <label className={cn(cell, missing && !agency && "ring-2 ring-danger/60", "md:col-span-2 lg:col-span-1")}>
        <MapPin className="size-5 shrink-0 text-majorelle" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={label}>
            {t("searchPlace")} <span className="text-danger" aria-hidden>*</span>
          </span>
          <select name="agency" required value={agency} onChange={(e) => setAgency(e.target.value)} className={cn(input, "appearance-none")}>
            <option value="" disabled>{t("searchPlaceholder")}</option>
            {byCity.map(([city, list]) => (
              <optgroup key={city} label={city}>
                {list.map((a) => (
                  <option key={a.id} value={a.id}>{a.city} · {a.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {chosen && <span className="truncate text-xs text-ink-3">{chosen.address}</span>}
        </span>
      </label>
      <div className={cell}>
        <CalendarDays className="size-5 shrink-0 text-majorelle" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={label}>
            {t("searchStart")} <span className="text-danger" aria-hidden>*</span>
          </span>
          <span className="flex items-center gap-2">
            <input aria-label={t("searchStart")} type="date" name="start" required value={start} min={todayISO()} onChange={(e) => { setStart(e.target.value); if (e.target.value >= end) setEnd(e.target.value); }} className={input} />
            <span className="flex items-center gap-1 text-ink-3">
              <Clock className="size-3.5" aria-hidden />
              <input aria-label={t("searchStartTime")} type="time" name="startTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-[5.5rem] bg-transparent text-sm font-medium text-ink outline-none" />
            </span>
          </span>
        </span>
      </div>
      <div className={cell}>
        <CalendarDays className="size-5 shrink-0 text-majorelle" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={label}>
            {t("searchEnd")} <span className="text-danger" aria-hidden>*</span>
          </span>
          <span className="flex items-center gap-2">
            <input aria-label={t("searchEnd")} type="date" name="end" required value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={input} />
            <span className="flex items-center gap-1 text-ink-3">
              <Clock className="size-3.5" aria-hidden />
              <input aria-label={t("searchEndTime")} type="time" name="endTime" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-[5.5rem] bg-transparent text-sm font-medium text-ink outline-none" />
            </span>
          </span>
        </span>
      </div>
      <button type="submit" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-majorelle px-7 font-bold text-white transition-colors hover:bg-majorelle-deep md:col-span-2 lg:col-span-1 lg:h-auto dark:text-[#0f1322]">
        <Search className="size-5" aria-hidden />
        {t("searchSubmit")}
      </button>
      {missing && (!agency || !start || !end) && <p className="px-4 pb-2 text-sm font-medium text-danger md:col-span-2 lg:col-span-4" role="alert">{t("searchRequired")}</p>}
    </form>
  );
}
