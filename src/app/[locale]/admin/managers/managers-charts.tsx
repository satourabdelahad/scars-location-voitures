"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "@/components/charts/use-chart-theme";
import { intlLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

type Period = "day" | "week" | "month" | "year";
type Row = { id: string; firstName: string; lastName: string; status: string; rentalsDay: number; rentalsWeek: number; rentalsMonth: number; rentalsYear: number };
const KEY: Record<Period, keyof Row> = { day: "rentalsDay", week: "rentalsWeek", month: "rentalsMonth", year: "rentalsYear" };
const MAX_SERIES = 7; // au-delà, regroupés dans "Autres" (jamais de couleur générée)

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-mist bg-paper px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-ink-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="font-semibold text-ink tabular">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function ManagersCharts({ managers, trend }: { managers: Row[]; trend: { day: string; manager_id: string; n: number }[] }) {
  const t = useTranslations("Managers");
  const locale = useLocale();
  const theme = useChartTheme();
  const [period, setPeriod] = useState<Period>("month");
  const active = managers.filter((m) => m.status === "active");

  const bars = useMemo(
    () => active.map((m) => ({ name: `${m.firstName} ${m.lastName.charAt(0)}.`, full: `${m.firstName} ${m.lastName}`, value: m[KEY[period]] as number })).sort((a, b) => b.value - a.value),
    [active, period],
  );

  // Séries de tendance : couleur attachée au gestionnaire (ordre alphabétique stable), pas à son rang.
  const series = useMemo(() => {
    const ordered = [...active].sort((a, b) => a.lastName.localeCompare(b.lastName));
    const totals = new Map<string, number>();
    for (const r of trend) totals.set(r.manager_id, (totals.get(r.manager_id) ?? 0) + r.n);
    const top = ordered.length > MAX_SERIES + 1 ? new Set([...ordered].sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0)).slice(0, MAX_SERIES).map((m) => m.id)) : null;
    return ordered.map((m, i) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, color: theme.series[i % 8], inTop: !top || top.has(m.id) }));
  }, [active, trend, theme]);

  // Cumul jour après jour : les volumes quotidiens (0 à 3) sont trop faibles pour une courbe lisible.
  const trendData = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "short" });
    const visibleIds = new Set(series.filter((s) => s.inTop).map((s) => s.id));
    const days = [...new Set(trend.map((r) => r.day))].sort();
    const running: Record<string, number> = {};
    return days.map((day) => {
      for (const r of trend) {
        if (r.day !== day) continue;
        const key = visibleIds.has(r.manager_id) ? r.manager_id : "__other";
        running[key] = (running[key] ?? 0) + r.n;
      }
      return { label: fmt.format(new Date(`${day}T12:00:00`)), ...running };
    });
  }, [trend, series, locale]);
  const hasOther = series.some((s) => !s.inTop);

  const periods: { id: Period; label: string }[] = [
    { id: "day", label: t("periodDay") },
    { id: "week", label: t("periodWeek") },
    { id: "month", label: t("periodMonth") },
    { id: "year", label: t("periodYear") },
  ];
  const axis = { stroke: theme.axis, fontSize: 12, tickLine: false, axisLine: false } as const;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
      <section className="rounded-2xl border border-mist bg-paper p-5" aria-labelledby="chart-period">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="chart-period" className="font-bold text-ink">{t("statsTitle")}</h2>
            <p className="mt-0.5 text-xs text-ink-3">{t("statsSubtitle")}</p>
          </div>
          <div role="tablist" className="flex rounded-[10px] bg-chalk p-1">
            {periods.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", period === p.id ? "bg-paper text-ink shadow-sm" : "text-ink-3 hover:text-ink")}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} margin={{ top: 16, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis dataKey="name" {...axis} interval={0} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip cursor={{ fill: theme.grid, opacity: 0.5 }} content={({ active, payload }) => (
                <ChartTooltip active={active} label={payload?.[0]?.payload?.full} payload={payload?.map((p) => ({ name: t(`rentals${period.charAt(0).toUpperCase()}${period.slice(1)}` as "rentalsDay"), value: Number(p.value), color: theme.single }))} />
              )} />
              <Bar dataKey="value" fill={theme.single} radius={[4, 4, 0, 0]} maxBarSize={44} label={{ position: "top", fill: theme.text, fontSize: 12, fontWeight: 600 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-mist bg-paper p-5" aria-labelledby="chart-trend">
        <h2 id="chart-trend" className="font-bold text-ink">{t("trendTitle")}</h2>
        <p className="mt-0.5 mb-4 text-xs text-ink-3">{t("trendSubtitle")}</p>
        <div className="h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis dataKey="label" {...axis} minTickGap={24} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip cursor={{ stroke: theme.axis, strokeDasharray: "3 3" }} content={({ active, payload, label }) => (
                <ChartTooltip active={active} label={String(label ?? "")} payload={payload?.map((p) => ({ name: String(p.name), value: Number(p.value), color: String(p.color) }))} />
              )} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(value) => <span style={{ color: theme.text }}>{value}</span>} />
              {series.filter((s) => s.inTop).map((s) => (
                <Line key={s.id} type="linear" dataKey={s.id} name={s.name} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: theme.surface }} />
              ))}
              {hasOther && <Line type="monotone" dataKey="__other" name="…" stroke={theme.other} strokeWidth={2} strokeDasharray="4 3" dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
