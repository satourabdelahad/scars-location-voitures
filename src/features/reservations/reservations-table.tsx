"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { useRowPatches } from "@/components/data-table/use-row-patches";
import { ReservationRowActions } from "./reservation-actions";
import { Badge, reservationTone } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { reservationStatusEnum } from "@/db/schema";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import type { StaffReservationRow } from "@/server/queries/reservations";

export function ReservationsTable({
  rows: serverRows,
  base,
  prefs,
  userId,
  isAdmin,
}: {
  rows: StaffReservationRow[];
  base: string;
  prefs: { visibleColumns: string[]; pageSize: number } | null;
  /** Pour savoir si l'utilisateur peut valider : administrateur ou responsable de l'agence de départ */
  userId: string;
  isAdmin: boolean;
}) {
  const t = useTranslations("Reservations");
  const ts = useTranslations("Status");
  const c = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  // Nouvel état affiché tout de suite après une action de la colonne.
  const [rows, patch] = useRowPatches(serverRows);

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
      {
        id: "actions",
        header: c("actions"),
        text: () => "",
        isAction: true,
        align: "end",
        cell: (r) => <ReservationRowActions id={r.id} status={r.status} canValidate={isAdmin || r.responsibleUserIds.includes(userId)} onDone={(status) => patch(r.id, { status })} detailHref={`${base}/reservations/${r.id}`} />,
      },
    ],
    [t, ts, c, locale, base, patch, isAdmin, userId],
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
