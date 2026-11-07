"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "@/components/charts/use-chart-theme";
import { Panel } from "@/components/ui/misc";
import { intlLocale } from "@/i18n/config";
import { formatMoney } from "@/lib/utils";
import type { RentalRow } from "@/server/queries/manager-profile";

/** Chiffre d'affaires des locations réalisées, mois par mois sur 12 mois. */
export function RentalsChart({ rows }: { rows: RentalRow[] }) {
  const t = useTranslations("My");
  const locale = useLocale();
  const theme = useChartTheme();
  const data = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale(locale), { month: "short" });
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, name: fmt.format(d), revenue: 0, count: 0 };
    });
    const idx = new Map(months.map((m, i) => [m.key, i]));
    for (const r of rows) {
      const i = idx.get(r.startDate.slice(0, 7));
      if (i === undefined) continue;
      months[i].revenue += r.total;
      months[i].count += 1;
    }
    return months;
  }, [rows, locale]);
  const axis = { stroke: theme.axis, fontSize: 12, tickLine: false, axisLine: false } as const;

  return (
    <Panel className="p-5">
      <h2 className="font-bold text-ink">{t("chartTitle")}</h2>
      <p className="mt-0.5 text-xs text-ink-3">{t("chartHint")}</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barCategoryGap="26%">
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="name" {...axis} interval={0} />
            <YAxis {...axis} width={64} tickFormatter={(v: number) => new Intl.NumberFormat(intlLocale(locale), { notation: "compact" }).format(v)} />
            <Tooltip
              cursor={{ fill: theme.grid, opacity: 0.5 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-xl border border-mist bg-paper px-3 py-2 text-xs shadow-lg">
                    <p className="mb-1 font-semibold text-ink capitalize">{label}</p>
                    <p className="text-ink-2">{formatMoney(Number(payload[0].value), locale)}</p>
                    <p className="text-ink-3">{t("rentals", { count: (payload[0].payload as { count: number }).count })}</p>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="revenue" fill={theme.single} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
