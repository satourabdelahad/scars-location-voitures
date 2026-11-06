"use client";

import { Eye, Mail, Pencil, Phone, Power, PowerOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { ManagerAvatar } from "@/features/managers/manager-avatar";
import { bulkAgencyStatus } from "@/server/actions/agencies";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { useRowPatches } from "@/components/data-table/use-row-patches";
import { Badge } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/utils";
import type { AgencyRow, Responsible } from "@/server/queries/agencies";
import { AgencyStatusButton } from "./agency-status";

/** « Mes agences » : même tableau que les gestionnaires (recherche, filtres, colonnes, export). */
export function AgenciesTable({ rows: serverRows, base, isAdmin, prefs }: { rows: AgencyRow[]; base: string; isAdmin: boolean; prefs: { visibleColumns: string[]; pageSize: number } | null }) {
  const t = useTranslations("Agencies");
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
      { id: "city", header: t("city"), text: (a) => a.city, filter: { type: "combobox" } },
      {
        id: "responsibles",
        header: t("responsibles"),
        text: (a) => a.responsibles.map((m) => `${e(`civility.${m.civility}`)} ${m.lastName} ${m.firstName} ${m.phone} ${m.email ?? ""}`).join(" · "),
        filter: { type: "text" },
        minWidth: 240,
        addedLater: true,
        cell: (a) => (a.responsibles.length ? <ResponsibleCell people={a.responsibles} base={base} civility={(c) => e(`civility.${c}`)} /> : <span className="text-ink-3">{t("noResponsible")}</span>),
      },
      { id: "address", header: t("address"), text: (a) => a.address, filter: { type: "text" }, minWidth: 200 },
      { id: "phone", header: t("phone"), text: (a) => a.phone ?? "", filter: { type: "text" }, cell: (a) => (a.phone ? <a href={`tel:${a.phone}`} dir="ltr" className="tabular hover:text-majorelle">{a.phone}</a> : "—") },
      {
        id: "whatsapp",
        header: t("whatsapp"),
        text: (a) => a.whatsapp ?? "",
        filter: { type: "text" },
        cell: (a) => (a.whatsapp ? <a href={`https://wa.me/${a.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener" dir="ltr" className="tabular text-palm hover:underline">{a.whatsapp}</a> : "—"),
      },
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
    [t, c, e, locale, base, isAdmin, patch],
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
      bulkActions={isAdmin ? (selected, clear) => <AgenciesBulkActions selected={selected} onDone={(ids, isActive) => { patch(ids, { isActive }); clear(); }} /> : undefined}
    />
  );
}

/** Responsables dans une seule cellule : photo, « Civilité Nom Prénom », téléphone et email ; tout mène à la fiche du gestionnaire. */
function ResponsibleCell({ people, base, civility }: { people: Responsible[]; base: string; civility: (c: Responsible["civility"]) => string }) {
  return (
    <ul className="grid gap-2">
      {people.map((m) => (
        <li key={m.id}>
          <Link href={`${base}/managers/${m.id}`} className={`group flex items-center gap-2.5 rounded-lg ${m.active ? "" : "opacity-60"}`}>
            <ManagerAvatar photoUrl={m.photoUrl} firstName={m.firstName} lastName={m.lastName} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-ink group-hover:text-majorelle group-hover:underline">
                {civility(m.civility)} {m.lastName} {m.firstName}
              </span>
              {m.phone && <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-3 tabular" dir="ltr"><Phone className="size-3 shrink-0" />{m.phone}</span>}
              {m.email && <span className="flex items-center gap-1 truncate text-xs text-ink-3" dir="ltr"><Mail className="size-3 shrink-0" />{m.email}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Actions groupées : désactiver (motif obligatoire) ou réactiver les agences cochées. */
function AgenciesBulkActions({ selected, onDone }: { selected: AgencyRow[]; onDone: (ids: string[], isActive: boolean) => void }) {
  const t = useTranslations("Agencies");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const active = selected.filter((a) => a.isActive);
  const inactive = selected.filter((a) => !a.isActive);

  const run = (on: boolean, rows: AgencyRow[]) =>
    start(async () => {
      const r = await bulkAgencyStatus(rows.map((a) => a.agencyId), on, on ? undefined : reason);
      if (!r.ok) return void toast.error(te(r.error as "unknown"));
      const { done, skipped } = r.data!;
      toast.success(t(on ? "bulkActivated" : "bulkDeactivated", { count: done.length }));
      if (skipped) toast.warning(t("bulkSkipped", { count: skipped }));
      onDone(rows.filter((a) => done.includes(a.agencyId)).map((a) => a.id), on);
      setAsking(false);
      setReason("");
      router.refresh();
    });

  return (
    <>
      <Button size="sm" variant="dangerOutline" disabled={pending || active.length === 0} onClick={() => setAsking(true)}>
        <PowerOff />
        {t("deactivate")} {active.length > 0 && `(${active.length})`}
      </Button>
      <Button size="sm" variant="success" loading={pending} disabled={pending || inactive.length === 0} onClick={() => run(true, inactive)}>
        <Power />
        {t("reactivate")} {inactive.length > 0 && `(${inactive.length})`}
      </Button>
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent title={t("bulkDeactivateTitle", { count: active.length })} description={t("deactivateBody")} closeLabel={tc("close")}>
          <p className="mb-3 text-sm text-ink-2">{active.map((a) => a.name).join(", ")}</p>
          <Field label={t("reason")} required>
            {(p) => <Textarea {...p} autoFocus value={reason} onChange={(x) => setReason(x.target.value)} />}
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAsking(false)}>{tc("cancel")}</Button>
            <Button variant="danger" loading={pending} disabled={reason.trim().length < 3} onClick={() => run(false, active)}>
              <PowerOff />
              {t("deactivate")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
