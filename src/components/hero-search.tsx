"use client";

import { CalendarDays, MapPin, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { todayISO } from "@/lib/utils";

/** Barre de recherche posée sur la route. Fonctionne aussi sans JavaScript (formulaire GET). */
export function HeroSearch({ agencies, locale }: { agencies: { slug: string; city: string }[]; locale: string }) {
  const t = useTranslations("Home");
  const router = useRouter();
  const [start, setStart] = useState(todayISO(2));
  const [end, setEnd] = useState(todayISO(6));
  const cities = Array.from(new Map(agencies.map((a) => [a.city, a])).values());

  return (
    <form
      action={`/${locale}/cars`}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const qs = new URLSearchParams();
        for (const [k, v] of fd) if (v) qs.set(k, String(v));
        router.push(`/cars?${qs.toString()}`);
      }}
      className="grid gap-2 rounded-[22px] border border-mist bg-paper p-2 shadow-[0_30px_70px_-30px_rgba(20,26,46,.45)] md:grid-cols-[1.3fr_1fr_1fr_auto]"
    >
      <label className="flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-colors focus-within:bg-chalk hover:bg-chalk">
        <MapPin className="size-5 shrink-0 text-majorelle" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-semibold text-ink-3">{t("searchCity")}</span>
          <select name="city" defaultValue="" className="w-full appearance-none bg-transparent text-[15px] font-semibold text-ink outline-none">
            <option value="">—</option>
            {cities.map((a) => (
              <option key={a.slug} value={a.slug}>{a.city}</option>
            ))}
          </select>
        </span>
      </label>
      <label className="flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-colors focus-within:bg-chalk hover:bg-chalk">
        <CalendarDays className="size-5 shrink-0 text-majorelle" aria-hidden />
        <span className="flex flex-1 flex-col">
          <span className="text-xs font-semibold text-ink-3">{t("searchStart")}</span>
          <input type="date" name="start" value={start} min={todayISO()} onChange={(e) => { setStart(e.target.value); if (e.target.value >= end) setEnd(e.target.value); }} className="bg-transparent text-[15px] font-semibold text-ink outline-none" />
        </span>
      </label>
      <label className="flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-colors focus-within:bg-chalk hover:bg-chalk">
        <CalendarDays className="size-5 shrink-0 text-majorelle" aria-hidden />
        <span className="flex flex-1 flex-col">
          <span className="text-xs font-semibold text-ink-3">{t("searchEnd")}</span>
          <input type="date" name="end" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="bg-transparent text-[15px] font-semibold text-ink outline-none" />
        </span>
      </label>
      <button type="submit" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-majorelle px-7 font-bold text-white transition-colors hover:bg-majorelle-deep md:h-auto">
        <Search className="size-5" aria-hidden />
        {t("searchSubmit")}
      </button>
    </form>
  );
}
