"use client";

import { Eye, Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { useRowPatches } from "@/components/data-table/use-row-patches";
import { Badge } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/utils";
import type { AgencyRow } from "@/server/queries/agencies";
import { AgencyStatusButton } from "./agency-status";

/** « Mes agences » : même tableau que les gestionnaires (recherche, filtres, colonnes, export). */
export function AgenciesTable({ rows: serverRows, base, isAdmin, prefs }: { rows: AgencyRow[]; base: string; isAdmin: boolean; prefs: { visibleColumns: string[]; pageSize: number } | null }) {
  const t = useTranslations("Agencies");
  const tm = useTranslations("Managers");
  const c = useTranslations("Common");
  const e = useTranslations("Enums");
  const locale = useLocale();
  const router = useRouter();
  const [rows, patch] = useRowPatches(serverRows);
  const status = (a: AgencyRow) => (a.isActive ? c("active") : c("deactivated"));

  const columns = useMemo<Column<AgencyRow>[]>(
    () => [
      {
        id: "name",
        header: t("name"),
        text: (a) => a.name,
        filter: { type: "text" },
        minWidth: 180,
        cell: (a) => (
          <Link href={`${base}/agencies/${a.agencyId}`} className="font-semibold text-ink underline-offset-4 hover:text-majorelle hover:underline">
            {a.name}
            {a.isAirport && <Badge tone="info" className="ms-1.5">{t("airport")}</Badge>}
          </Link>
        ),
      },
      { id: "city", header: t("city"), text: (a) => a.city, filter: { type: "text" } },
      { id: "address", header: t("address"), text: (a) => a.address, filter: { type: "text" }, minWidth: 200 },
      { id: "phone", header: t("phone"), text: (a) => a.phone ?? "", filter: { type: "text" }, cell: (a) => (a.phone ? <a href={`tel:${a.phone}`} dir="ltr" className="tabular hover:text-majorelle">{a.phone}</a> : "—") },
      {
        id: "whatsapp",
        header: t("whatsapp"),
        text: (a) => a.whatsapp ?? "",
        filter: { type: "text" },
        cell: (a) => (a.whatsapp ? <a href={`https://wa.me/${a.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener" dir="ltr" className="tabular text-palm hover:underline">{a.whatsapp}</a> : "—"),
      },
      { id: "managerCivility", header: `${t("manager")} : ${tm("civility")}`, text: (a) => (a.managerCivility ? e(`civility.${a.managerCivility}`) : ""), defaultHidden: true },
      { id: "managerLastName", header: `${t("manager")} : ${tm("lastName")}`, text: (a) => a.managerLastName ?? "", filter: { type: "text" } },
      { id: "managerFirstName", header: `${t("manager")} : ${tm("firstName")}`, text: (a) => a.managerFirstName ?? "", filter: { type: "text" } },
      { id: "managerEmail", header: `${t("manager")} : ${tm("email")}`, text: (a) => a.managerEmail ?? "", filter: { type: "text" }, cell: (a) => (a.managerEmail ? <a href={`mailto:${a.managerEmail}`} dir="ltr" className="hover:text-majorelle">{a.managerEmail}</a> : "—") },
      { id: "managerPhone", header: `${t("manager")} : ${tm("phone")}`, text: (a) => a.managerPhone ?? "", filter: { type: "text" }, cell: (a) => (a.managerPhone ? <a href={`tel:${a.managerPhone}`} dir="ltr" className="tabular hover:text-majorelle">{a.managerPhone}</a> : "—") },
      { id: "cars", header: t("cars"), text: (a) => String(a.cars), sortValue: (a) => a.cars, align: "end" },
      { id: "updatedAt", header: t("updatedAt"), text: (a) => formatDateTime(a.updatedAt, locale), sortValue: (a) => a.updatedAt, defaultHidden: true },
      {
        id: "status",
        header: c("status"),
        text: (a) => status(a),
        filter: { type: "select", options: [{ value: c("active"), label: c("active") }, { value: c("deactivated"), label: c("deactivated") }] },
        cell: (a) => (
          <span title={a.deactivationReason ?? undefined}>
            <Badge tone={a.isActive ? "success" : "neutral"} dot>{status(a)}</Badge>
          </span>
        ),
      },
      {
        id: "actions",
        header: c("actions"),
        text: () => "",
        isAction: true,
        align: "end",
        cell: (a) => (
          <div className="flex items-center justify-end gap-1">
            <Link href={`${base}/agencies/${a.agencyId}${isAdmin ? "?tab=infos" : ""}`} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-mist hover:text-ink" aria-label={isAdmin ? c("edit") : c("view")} title={isAdmin ? c("edit") : c("view")}>
              {isAdmin ? <Pencil className="size-4" /> : <Eye className="size-4" />}
            </Link>
            {isAdmin && <AgencyStatusButton id={a.agencyId} name={a.name} active={a.isActive} compact onDone={(isActive) => patch(a.id, { isActive })} />}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tm, c, e, locale, base, isAdmin, patch],
  );

  return (
    <DataTable
      tableKey="agencies"
      columns={columns}
      data={rows}
      initialPrefs={prefs}
      exportTitle={t("title")}
      exportFilename="agences"
      rowClassName={(a) => (a.isActive ? undefined : "opacity-60")}
      onRowClick={(a) => router.push(`${base}/agencies/${a.agencyId}`)}
    />
  );
}
