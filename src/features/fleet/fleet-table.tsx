"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { CarArt } from "@/components/car-art";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { carCategoryEnum, fuelEnum, transmissionEnum } from "@/db/schema";
import { formatDate, formatMoney } from "@/lib/utils";
import type { FleetRow } from "@/server/queries/fleet";

export function FleetTable({ rows, base, prefs }: { rows: FleetRow[]; base: string; prefs: { visibleColumns: string[]; pageSize: number } | null }) {
  const t = useTranslations("Fleet");
  const e = useTranslations("Enums");
  const ts = useTranslations("Status");
  const c = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const columns = useMemo<Column<FleetRow>[]>(
    () => [
      {
        id: "car",
        header: `${t("brand")} / ${t("model")}`,
        text: (r) => `${r.brand} ${r.model}`,
        filter: { type: "text" },
        minWidth: 220,
        cell: (r) => (
          <Link href={`${base}/fleet/${r.id}`} className="flex items-center gap-3">
            <span className="relative grid h-10 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-chalk">
              {r.cover ? <Image src={r.cover} alt="" fill sizes="64px" className="object-cover" /> : <CarArt category={r.category} color={r.colorHex} className="w-14" />}
            </span>
            <span>
              <span className="block font-semibold text-ink">{r.brand} {r.model}</span>
              <span className="text-xs text-ink-3">{r.year}</span>
            </span>
          </Link>
        ),
      },
      { id: "plateNumber", header: t("plateNumber"), text: (r) => r.plateNumber, filter: { type: "text" }, cell: (r) => <span dir="ltr" className="rounded-md border border-mist-2 bg-chalk px-2 py-0.5 font-mono text-xs text-ink">{r.plateNumber}</span> },
      {
        id: "category",
        header: t("category"),
        text: (r) => e(`category.${r.category}`),
        filter: { type: "select", options: carCategoryEnum.enumValues.map((c) => ({ value: c, label: e(`category.${c}`) })) },
      },
      { id: "transmission", header: t("transmission"), text: (r) => e(`transmission.${r.transmission}`), defaultHidden: true, filter: { type: "select", options: transmissionEnum.enumValues.map((v) => ({ value: v, label: e(`transmission.${v}`) })) } },
      { id: "fuel", header: t("fuel"), text: (r) => e(`fuel.${r.fuel}`), defaultHidden: true, filter: { type: "select", options: fuelEnum.enumValues.map((v) => ({ value: v, label: e(`fuel.${v}`) })) } },
      { id: "colorName", header: t("colorName"), text: (r) => r.colorName, defaultHidden: true, filter: { type: "text" }, cell: (r) => <span className="flex items-center gap-2"><span className="size-3 rounded-full border border-mist-2" style={{ background: r.colorHex }} />{r.colorName}</span> },
      { id: "city", header: t("agency"), text: (r) => `${r.city}, ${r.agencyName}`, filter: { type: "text" } },
      { id: "mileage", header: t("mileage"), text: (r) => `${r.mileage.toLocaleString(locale)} km`, sortValue: (r) => r.mileage, align: "end", defaultHidden: true },
      { id: "dailyPrice", header: t("dailyPrice"), text: (r) => formatMoney(r.dailyPrice, locale), sortValue: (r) => r.dailyPrice, align: "end", filter: { type: "text" } },
      { id: "purchaseCity", header: t("purchaseCity"), text: (r) => r.purchaseCity ?? "", filter: { type: "text" }, defaultHidden: true },
      { id: "purchaseDate", header: t("purchaseDate"), text: (r) => (r.purchaseDate ? formatDate(r.purchaseDate, locale) : ""), sortValue: (r) => r.purchaseDate, defaultHidden: true },
      { id: "purchasePrice", header: t("purchasePrice"), text: (r) => (r.purchasePrice != null ? formatMoney(r.purchasePrice, locale) : ""), sortValue: (r) => r.purchasePrice, align: "end", defaultHidden: true },
      { id: "reservationsCount", header: t("reservationsCount"), text: (r) => String(r.reservationsCount), sortValue: (r) => r.reservationsCount, align: "end" },
      {
        id: "nextBooking",
        header: t("nextBooking"),
        text: (r) => (r.onRoad ? ts("ongoing") : r.nextBooking ? formatDate(r.nextBooking, locale) : t("free")),
        sortValue: (r) => r.nextBooking,
      },
      {
        id: "status",
        header: c("status"),
        text: (r) => (r.status === "active" ? t("statusActive") : t("statusDeactivated")),
        filter: { type: "select", options: [{ value: "active", label: t("statusActive") }, { value: "deactivated", label: t("statusDeactivated") }] },
        cell: (r) =>
          r.status === "active" ? (
            <Badge tone={r.onRoad ? "dark" : "success"} dot>{t("statusActive")}</Badge>
          ) : (
            <Badge tone="neutral" dot>{t("statusDeactivated")} ({e(`carDeactivation.${r.deactivationReason ?? "other"}`)})</Badge>
          ),
      },
    ],
    [t, e, ts, c, locale, base],
  );

  return (
    <DataTable
      tableKey="fleet"
      columns={columns}
      data={rows}
      initialPrefs={prefs}
      exportTitle={t("title")}
      exportFilename="parc-automobile"
      rowClassName={(r) => (r.status === "deactivated" ? "opacity-55" : undefined)}
      onRowClick={(r) => router.push(`${base}/fleet/${r.id}`)}
    />
  );
}
