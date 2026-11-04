"use client";

import { KeyRound, Phone, Plane, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Timeline } from "@/components/timeline";
import { Badge, Panel, reservationTone } from "@/components/ui/misc";
import { useViewMode, ViewToggle } from "@/components/view-toggle";
import { Link } from "@/i18n/navigation";
import { intlLocale } from "@/i18n/config";
import { formatDate } from "@/lib/utils";
import type { AppointmentRow } from "@/server/queries/manager-profile";

/** "Mes rendez-vous" : départs et retours à venir, en frise ou en tableau. */
export function Appointments({ rows, reservationsBase }: { rows: AppointmentRow[]; reservationsBase: string }) {
  const t = useTranslations("My");
  const ts = useTranslations("Status");
  const locale = useLocale();
  const [mode, setMode] = useViewMode("my-appointments", "timeline");
  const today = new Date().toISOString().slice(0, 10);
  const counts = { today: rows.filter((r) => r.at === today).length, pickup: rows.filter((r) => r.kind === "pickup").length, ret: rows.filter((r) => r.kind === "return").length };
  const day = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", day: "numeric", month: "long" });

  const columns = useMemo<Column<AppointmentRow>[]>(
    () => [
      { id: "at", header: t("date"), text: (r) => formatDate(r.at, locale), sortValue: (r) => r.at },
      { id: "kind", header: t("type"), text: (r) => t(r.kind), filter: { type: "select", options: [{ value: t("pickup"), label: t("pickup") }, { value: t("return"), label: t("return") }] }, cell: (r) => <Badge tone={r.kind === "pickup" ? "info" : "success"}>{t(r.kind)}</Badge> },
      { id: "car", header: t("car"), text: (r) => `${r.car} ${r.plate}`, filter: { type: "text" }, cell: (r) => <span><span className="font-semibold text-ink">{r.car}</span> <span dir="ltr" className="font-mono text-xs text-ink-3">{r.plate}</span></span> },
      { id: "driver", header: t("client"), text: (r) => r.driver, filter: { type: "text" } },
      { id: "phone", header: t("phone"), text: (r) => r.phone, cell: (r) => <a href={`tel:${r.phone}`} dir="ltr" className="hover:text-majorelle">{r.phone}</a> },
      { id: "agency", header: t("agency"), text: (r) => r.agency, filter: { type: "text" } },
      { id: "reference", header: t("reference"), text: (r) => r.reference, cell: (r) => <Link href={`${reservationsBase}/${r.reservationId}`} dir="ltr" className="font-mono text-xs font-semibold hover:text-majorelle">{r.reference}</Link> },
      { id: "status", header: t("status"), text: (r) => ts(r.status), cell: (r) => <Badge tone={reservationTone[r.status]} dot>{ts(r.status)}</Badge> },
    ],
    [t, ts, locale, reservationsBase],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [t("todayCount"), counts.today],
          [t("pickupsCount"), counts.pickup],
          [t("returnsCount"), counts.ret],
        ].map(([label, value]) => (
          <Panel key={String(label)} className="p-5">
            <p className="text-xs font-medium text-ink-3">{label}</p>
            <p className="mt-2 text-3xl font-extrabold text-ink tabular" style={{ fontStretch: "112%" }}>{value}</p>
          </Panel>
        ))}
      </div>
      <div className="flex justify-end"><ViewToggle mode={mode} onChange={setMode} /></div>
      {mode === "table" ? (
        <DataTable tableKey="my-appointments" columns={columns} data={rows} exportTitle={t("appointmentsTitle")} exportFilename="rendez-vous" />
      ) : (
        <Panel className="p-6">
          <Timeline
            monthLabel={(iso) => new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric" }).format(new Date(`${iso}T12:00:00`))}
            empty={t("appointmentsEmpty")}
            items={rows.map((r) => ({
              id: r.id,
              at: r.at,
              icon: r.kind === "pickup" ? <KeyRound /> : <Undo2 />,
              tone: r.kind === "pickup" ? "bg-majorelle-soft text-majorelle" : "bg-palm-soft text-palm",
              title: (
                <Link href={`${reservationsBase}/${r.reservationId}`} className="hover:text-majorelle">
                  {t(r.kind)} · {r.car} <span className="font-normal text-ink-3">· {r.driver}</span>
                </Link>
              ),
              meta: (
                <span className="capitalize">
                  {day.format(new Date(`${r.at}T12:00:00`))}
                  {r.at === today && <Badge tone="warning" className="ms-2 normal-case">{t("today")}</Badge>}
                </span>
              ),
              detail: (
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-ink-3">
                  <span>{r.agency}</span>
                  <a href={`tel:${r.phone}`} dir="ltr" className="inline-flex items-center gap-1 hover:text-majorelle"><Phone className="size-3.5" />{r.phone}</a>
                  {r.flight && <span className="inline-flex items-center gap-1" dir="ltr"><Plane className="size-3.5" />{r.flight}</span>}
                </span>
              ),
              aside: <Badge tone={reservationTone[r.status]}>{ts(r.status)}</Badge>,
            }))}
          />
        </Panel>
      )}
    </div>
  );
}
