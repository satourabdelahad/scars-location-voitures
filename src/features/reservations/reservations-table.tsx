"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Badge, reservationTone } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { reservationStatusEnum } from "@/db/schema";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import type { StaffReservationRow } from "@/server/queries/reservations";

export function ReservationsTable({ rows, base, prefs }: { rows: StaffReservationRow[]; base: string; prefs: { visibleColumns: string[]; pageSize: number } | null }) {
  const t = useTranslations("Reservations");
  const ts = useTranslations("Status");
  const c = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const columns = useMemo<Column<StaffReservationRow>[]>(
    () => [
      {
        id: "reference",
        header: t("reference"),
        text: (r) => r.reference,
        filter: { type: "text" },
        cell: (r) => <Link href={`${base}/reservations/${r.id}`} dir="ltr" className="font-mono text-xs font-semibold text-ink hover:text-majorelle">{r.reference}</Link>,
      },
      {
        id: "status",
        header: c("status"),
        text: (r) => ts(r.status),
        filter: { type: "select", options: reservationStatusEnum.enumValues.map((s) => ({ value: s, label: ts(s) })) },
        cell: (r) => <Badge tone={reservationTone[r.status]} dot>{ts(r.status)}</Badge>,
      },
      { id: "driver", header: t("driver"), text: (r) => r.driver, filter: { type: "text" } },
      { id: "client", header: t("client"), text: (r) => r.clientEmail ?? r.clientName ?? "", filter: { type: "text" }, defaultHidden: true },
      { id: "car", header: t("car"), text: (r) => `${r.car} (${r.plate})`, filter: { type: "text" } },
      { id: "period", header: t("period"), text: (r) => `${formatDate(r.startDate, locale)} – ${formatDate(r.endDate, locale)}`, sortValue: (r) => r.startDate, filter: { type: "text" } },
      { id: "pickup", header: t("pickup"), text: (r) => r.pickup, filter: { type: "text" } },
      { id: "total", header: t("total"), text: (r) => formatMoney(r.totalPrice, locale), sortValue: (r) => r.totalPrice, align: "end" },
      { id: "handledBy", header: t("handledBy"), text: (r) => r.handledBy ?? "", filter: { type: "text" } },
      { id: "createdAt", header: t("createdAt"), text: (r) => formatDateTime(r.createdAt, locale), sortValue: (r) => new Date(r.createdAt).getTime(), defaultHidden: true },
    ],
    [t, ts, c, locale, base],
  );

  return (
    <DataTable
      tableKey="reservations"
      columns={columns}
      data={rows}
      initialPrefs={prefs}
      exportTitle={t("title")}
      exportFilename="reservations"
      onRowClick={(r) => router.push(`${base}/reservations/${r.id}`)}
    />
  );
}
