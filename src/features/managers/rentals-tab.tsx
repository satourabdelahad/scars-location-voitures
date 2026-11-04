"use client";

import { CalendarDays, CarFront, Coins, TicketPercent } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { CarArt } from "@/components/car-art";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Timeline } from "@/components/timeline";
import { Badge, Panel, reservationTone } from "@/components/ui/misc";
import { useViewMode, ViewToggle } from "@/components/view-toggle";
import { Link } from "@/i18n/navigation";
import { intlLocale } from "@/i18n/config";
import { promotionLabel } from "@/lib/promotion-label";
import { formatDate, formatMoney } from "@/lib/utils";
import type { CarCategory } from "@/db/schema";
import type { RentalRow } from "@/server/queries/manager-profile";

/** Onglet "Réalisations" : les locations confirmées par le gestionnaire, en tableau ou en frise. */
export function RentalsTab({ rows, reservationsBase }: { rows: RentalRow[]; reservationsBase: string }) {
  const t = useTranslations("Managers");
  const tf = useTranslations("Fleet");
  const tr = useTranslations("Reservations");
  const ts = useTranslations("Status");
  const e = useTranslations("Enums");
  const c = useTranslations("Common");
  const locale = useLocale();
  const [mode, setMode] = useViewMode("manager-rentals");

  const stats = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + r.total, 0);
    const days = rows.reduce((s, r) => s + r.days, 0);
    return {
      count: rows.length,
      revenue,
      avg: rows.length ? Math.round((days / rows.length) * 10) / 10 : 0,
      promo: rows.filter((r) => r.promotion).length,
    };
  }, [rows]);

  const columns = useMemo<Column<RentalRow>[]>(
    () => [
      {
        id: "reference",
        header: tr("reference"),
        text: (r) => r.reference,
        filter: { type: "text" },
        cell: (r) => (
          <Link href={`${reservationsBase}/${r.id}`} dir="ltr" className="font-mono text-xs font-semibold text-ink hover:text-majorelle">
            {r.reference}
          </Link>
        ),
      },
      {
        id: "car",
        header: tr("car"),
        text: (r) => r.car,
        filter: { type: "text" },
        minWidth: 200,
        cell: (r) => (
          <span className="flex items-center gap-2.5">
            <span className="grid h-8 w-12 shrink-0 place-items-center rounded-md bg-chalk">
              <CarArt category={r.category as CarCategory} color={r.colorHex} className="w-11" />
            </span>
            <span>
              <span className="block font-semibold text-ink">{r.car}</span>
              <span className="text-xs text-ink-3">{e(`category.${r.category as CarCategory}`)}</span>
            </span>
          </span>
        ),
      },
      { id: "model", header: tf("model"), text: (r) => `${r.car} ${r.year}`, defaultHidden: true },
      { id: "plate", header: tf("plateNumber"), text: (r) => r.plate, filter: { type: "text" }, cell: (r) => <span dir="ltr" className="font-mono text-xs">{r.plate}</span> },
      { id: "client", header: tr("client"), text: (r) => r.client, filter: { type: "text" } },
      { id: "period", header: tr("period"), text: (r) => `${formatDate(r.startDate, locale)} – ${formatDate(r.endDate, locale)}`, sortValue: (r) => r.startDate },
      { id: "days", header: t("duration"), text: (r) => c("days", { count: r.days }), sortValue: (r) => r.days, align: "end" },
      { id: "dailyPrice", header: tf("dailyPrice"), text: (r) => formatMoney(r.dailyPrice, locale), sortValue: (r) => r.dailyPrice, align: "end" },
      {
        id: "promotion",
        header: t("promotion"),
        text: (r) => (r.promotion ? promotionLabel(r.promotion) : ""),
        filter: { type: "text" },
        cell: (r) =>
          r.promotion ? (
            <Badge tone="success">
              <span dir="ltr">{promotionLabel(r.promotion)}</span>
            </Badge>
          ) : (
            <span className="text-ink-3">—</span>
          ),
      },
      { id: "discount", header: t("discount"), text: (r) => (r.discount ? `−${formatMoney(r.discount, locale)}` : ""), sortValue: (r) => r.discount, align: "end", defaultHidden: true },
      { id: "total", header: tr("total"), text: (r) => formatMoney(r.total, locale), sortValue: (r) => r.total, align: "end" },
      {
        id: "status",
        header: c("status"),
        text: (r) => ts(r.status),
        filter: { type: "select", options: (["confirmed", "ongoing", "completed"] as const).map((s) => ({ value: s, label: ts(s) })) },
        cell: (r) => <Badge tone={reservationTone[r.status]} dot>{ts(r.status)}</Badge>,
      },
    ],
    [t, tf, tr, ts, e, c, locale, reservationsBase],
  );

  const month = new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric" });
  const kpis = [
    { label: t("rentalsCount"), value: String(stats.count), Icon: CarFront },
    { label: t("rentalsRevenue"), value: formatMoney(stats.revenue, locale), Icon: Coins },
    { label: t("rentalsAvgDays"), value: c("days", { count: stats.avg }), Icon: CalendarDays },
    { label: t("rentalsPromo"), value: String(stats.promo), Icon: TicketPercent },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, Icon }) => (
          <Panel key={label} className="flex items-start gap-3 p-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-majorelle-soft text-majorelle"><Icon className="size-4" /></span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-ink-3">{label}</span>
              <span className="mt-1 block truncate text-2xl font-extrabold text-ink tabular" style={{ fontStretch: "112%" }}>{value}</span>
            </span>
          </Panel>
        ))}
      </div>

      <div className="flex justify-end">
        <ViewToggle mode={mode} onChange={setMode} />
      </div>

      {mode === "table" ? (
        <DataTable tableKey="manager-rentals" columns={columns} data={rows} exportTitle={t("tabRentals")} exportFilename="realisations" />
      ) : (
        <Panel className="p-6">
          <Timeline
            monthLabel={(iso) => month.format(new Date(`${iso.slice(0, 10)}T12:00:00`))}
            empty={t("rentalsEmpty")}
            items={rows.map((r) => ({
              id: r.id,
              at: r.startDate,
              icon: <CarFront />,
              tone: r.status === "completed" ? "bg-palm-soft text-palm" : r.status === "ongoing" ? "bg-ink text-chalk" : "bg-majorelle-soft text-majorelle",
              title: (
                <Link href={`${reservationsBase}/${r.id}`} className="hover:text-majorelle">
                  {r.car} <span className="font-normal text-ink-3">· {r.client}</span>
                </Link>
              ),
              meta: (
                <>
                  {formatDate(r.startDate, locale)} – {formatDate(r.endDate, locale)} · {c("days", { count: r.days })} × {formatMoney(r.dailyPrice, locale)}
                </>
              ),
              detail: r.promotion ? (
                <Badge tone="success"><TicketPercent className="size-3" /><span dir="ltr">{promotionLabel(r.promotion)}</span> −{formatMoney(r.discount, locale)}</Badge>
              ) : null,
              aside: (
                <>
                  <span className="block text-base font-extrabold text-ink tabular">{formatMoney(r.total, locale)}</span>
                  <Badge tone={reservationTone[r.status]} className="mt-1">{ts(r.status)}</Badge>
                </>
              ),
            }))}
          />
        </Panel>
      )}
    </div>
  );
}
