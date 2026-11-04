"use client";

import { Eye, MailPlus, Pencil, Power, PowerOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { useRowPatches } from "@/components/data-table/use-row-patches";
import { managerDisplayStatus, type ManagerDisplayStatus } from "@/lib/manager-status";
import { bulkManagerAction } from "@/server/actions/managers";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { ManagerActions } from "./manager-actions";
import { ExportMenu } from "@/components/data-table/export-menu";
import { Badge } from "@/components/ui/misc";
import { ManagerAvatar } from "./manager-avatar";
import { Link, useRouter } from "@/i18n/navigation";
import { localeMeta, type Locale } from "@/i18n/config";
import { exportRecord } from "@/lib/export";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ManagerRow } from "@/server/queries/managers";

export function useManagerFields() {
  const t = useTranslations("Managers");
  const e = useTranslations("Enums");
  const c = useTranslations("Common");
  const locale = useLocale();
  return (m: ManagerRow) => [
    { key: "civility", label: t("civility"), value: e(`civility.${m.civility}`) },
    { key: "lastName", label: t("lastName"), value: m.lastName },
    { key: "firstName", label: t("firstName"), value: m.firstName },
    { key: "email", label: t("email"), value: m.email },
    { key: "phone", label: t("phone"), value: m.phone },
    { key: "whatsapp", label: t("whatsapp"), value: m.whatsapp },
    { key: "city", label: t("city"), value: m.city },
    { key: "birthDate", label: t("birthDate"), value: formatDate(m.birthDate, locale) },
    { key: "maritalStatus", label: t("maritalStatus"), value: m.maritalStatus ? e(`marital.${m.maritalStatus}`) : "—" },
    { key: "workStartDate", label: t("workStartDate"), value: formatDate(m.workStartDate, locale) },
    { key: "contractType", label: t("contractType"), value: e(`contract.${m.contractType}`) },
    {
      key: "status",
      label: c("status"),
      value:
        managerDisplayStatus(m) === "active"
          ? c("active")
          : managerDisplayStatus(m) === "pending"
            ? t("pendingActivation")
            : `${c("deactivated")} (${m.deactivationReason ?? ""})`,
    },
    { key: "lastLogin", label: t("lastLogin"), value: m.lastLoginAt ? formatDateTime(m.lastLoginAt, locale) : c("never") },
    { key: "adminUpdatedAt", label: t("adminUpdatedAt"), value: formatDateTime(m.adminUpdatedAt, locale) },
    { key: "rentalsDay", label: t("rentalsDay"), value: String(m.rentalsDay) },
    { key: "rentalsWeek", label: t("rentalsWeek"), value: String(m.rentalsWeek) },
    { key: "rentalsMonth", label: t("rentalsMonth"), value: String(m.rentalsMonth) },
    { key: "rentalsYear", label: t("rentalsYear"), value: String(m.rentalsYear) },
    { key: "assignedCars", label: t("tabCars"), value: m.assignedCars.length ? m.assignedCars.join(", ") : t("noAssignedCarsShort") },
  ];
}

export function ManagerCardExport({ manager, size = "icon" }: { manager: ManagerRow; size?: "icon" | "md" }) {
  const t = useTranslations("Managers");
  const tt = useTranslations("Table");
  const fields = useManagerFields();
  const locale = useLocale() as Locale;
  return (
    <ExportMenu
      size={size}
      label={t("exportCard")}
      onExport={(f) =>
        exportRecord(
          {
            title: `${t("profileCard")} : ${manager.firstName} ${manager.lastName}`,
            subtitle: new Date().toLocaleString(),
            fields: fields(manager),
            filename: `gestionnaire-${manager.lastName}-${manager.firstName}`.toLowerCase(),
            rtl: localeMeta[locale].dir === "rtl",
            labels: { field: tt("field"), value: tt("value") },
          },
          f,
        )
      }
    />
  );
}

export function ManagersTable({ rows: serverRows, prefs }: { rows: ManagerRow[]; prefs: { visibleColumns: string[]; pageSize: number } | null }) {
  const t = useTranslations("Managers");
  const e = useTranslations("Enums");
  const c = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  // Nouvel état affiché tout de suite après une action, avant le rechargement des données.
  const [rows, patch] = useRowPatches(serverRows);
  const statusLabel = (s: ManagerDisplayStatus) => (s === "active" ? c("active") : s === "pending" ? t("pendingActivation") : c("deactivated"));

  const columns = useMemo<Column<ManagerRow>[]>(() => {
    const num = (id: keyof ManagerRow, header: string): Column<ManagerRow> => ({
      id,
      header,
      text: (m) => String(m[id]),
      sortValue: (m) => m[id] as number,
      align: "end",
      filter: { type: "text" },
    });
    return [
      {
        id: "photo",
        header: t("photo"),
        text: () => "",
        isAction: true,
        cell: (m) => (
          <Link href={`/admin/managers/${m.id}`} aria-label={`${m.firstName} ${m.lastName}`} className="block w-fit">
            <ManagerAvatar photoUrl={m.photoUrl} firstName={m.firstName} lastName={m.lastName} />
          </Link>
        ),
      },
      {
        id: "civility",
        header: t("civility"),
        text: (m) => e(`civility.${m.civility}`),
        filter: { type: "select", options: (["male", "female"] as const).map((v) => ({ value: v, label: e(`civility.${v}`) })) },
      },
      {
        id: "lastName",
        header: t("lastName"),
        text: (m) => m.lastName,
        filter: { type: "text" },
        cell: (m) => (
          <Link href={`/admin/managers/${m.id}`} className="font-semibold text-ink underline-offset-4 hover:text-majorelle hover:underline">{m.lastName}</Link>
        ),
      },
      {
        id: "firstName",
        header: t("firstName"),
        text: (m) => m.firstName,
        filter: { type: "text" },
        cell: (m) => (
          <Link href={`/admin/managers/${m.id}`} className="font-medium text-ink underline-offset-4 hover:text-majorelle hover:underline">{m.firstName}</Link>
        ),
      },
      { id: "email", header: t("email"), text: (m) => m.email, filter: { type: "text" }, cell: (m) => <a href={`mailto:${m.email}`} className="hover:text-majorelle" dir="ltr">{m.email}</a> },
      { id: "phone", header: t("phone"), text: (m) => m.phone, filter: { type: "text" }, cell: (m) => <a href={`tel:${m.phone}`} dir="ltr" className="tabular hover:text-majorelle">{m.phone}</a> },
      { id: "whatsapp", header: t("whatsapp"), text: (m) => m.whatsapp, filter: { type: "text" }, cell: (m) => <a href={`https://wa.me/${m.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener" dir="ltr" className="tabular text-palm hover:underline">{m.whatsapp}</a> },
      { id: "city", header: t("city"), text: (m) => m.city, filter: { type: "text" } },
      { id: "birthDate", header: t("birthDate"), text: (m) => formatDate(m.birthDate, locale), sortValue: (m) => m.birthDate, filter: { type: "text" } },
      {
        id: "maritalStatus",
        header: t("maritalStatus"),
        text: (m) => (m.maritalStatus ? e(`marital.${m.maritalStatus}`) : ""),
        filter: { type: "select", options: (["married", "widowed", "single"] as const).map((v) => ({ value: v, label: e(`marital.${v}`) })) },
      },
      { id: "workStartDate", header: t("workStartDate"), text: (m) => formatDate(m.workStartDate, locale), sortValue: (m) => m.workStartDate, filter: { type: "text" } },
      { id: "contractType", header: t("contractType"), text: (m) => e(`contract.${m.contractType}`), defaultHidden: true, filter: { type: "select", options: (["cdi", "cdd", "freelance"] as const).map((v) => ({ value: v, label: e(`contract.${v}`) })) } },
      {
        id: "status",
        header: c("status"),
        text: (m) => statusLabel(managerDisplayStatus(m)),
        filter: { type: "select", options: (["active", "pending", "deactivated"] as const).map((v) => ({ value: v, label: statusLabel(v) })) },
        cell: (m) => {
          const s = managerDisplayStatus(m);
          return (
            <span title={s === "deactivated" ? (m.deactivationReason ?? undefined) : undefined}>
              <Badge tone={s === "active" ? "success" : s === "pending" ? "warning" : "neutral"} dot>{statusLabel(s)}</Badge>
              {m.lockedUntil && <Badge tone="danger" className="ms-1.5">{t("locked")}</Badge>}
            </span>
          );
        },
      },
      { id: "lastLogin", header: t("lastLogin"), text: (m) => (m.lastLoginAt ? formatDateTime(m.lastLoginAt, locale) : c("never")), sortValue: (m) => m.lastLoginAt, filter: { type: "text" } },
      num("rentalsDay", t("rentalsDay")),
      num("rentalsWeek", t("rentalsWeek")),
      num("rentalsMonth", t("rentalsMonth")),
      num("rentalsYear", t("rentalsYear")),
      {
        id: "actions",
        header: c("actions"),
        isAction: true,
        text: () => "",
        align: "end",
        cell: (m) => (
          <div className="flex items-center justify-end gap-1">
            <ManagerCardExport manager={m} />
            <Link href={`/admin/managers/${m.id}`} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-mist hover:text-ink" aria-label={c("view")} title={c("view")}>
              <Eye className="size-4" />
            </Link>
            <Link href={`/admin/managers/${m.id}?edit=1`} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-mist hover:text-ink" aria-label={c("edit")} title={c("edit")}>
              <Pencil className="size-4" />
            </Link>
            <ManagerActions id={m.id} name={`${m.firstName} ${m.lastName}`} status={managerDisplayStatus(m)} compact onDone={(next) => patch(m.id, next)} />
          </div>
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, e, c, locale, patch]);

  return (
    <DataTable
      tableKey="managers"
      columns={columns}
      data={rows}
      initialPrefs={prefs}
      exportTitle={t("title")}
      exportFilename="gestionnaires"
      rowClassName={(m) => (managerDisplayStatus(m) === "deactivated" ? "opacity-60" : undefined)}
      onRowClick={(m) => router.push(`/admin/managers/${m.id}`)}
      bulkActions={(selected, clear) => <ManagersBulkActions selected={selected} onDone={(ids, next) => { if (next) patch(ids, next); clear(); }} />}
    />
  );
}

/** Action groupée sur les lignes cochées : Désactiver (avec motif), Activer, Renvoyer l'invitation. */
function ManagersBulkActions({
  selected,
  onDone,
}: {
  selected: ManagerRow[];
  onDone: (ids: string[], next: Partial<ManagerRow> | null) => void;
}) {
  const t = useTranslations("Managers");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const by = (s: ManagerDisplayStatus) => selected.filter((m) => managerDisplayStatus(m) === s);
  const active = by("active");
  const deactivated = by("deactivated");
  const invited = by("pending");

  const run = (action: "deactivate" | "activate" | "resend", rows: ManagerRow[]) =>
    start(async () => {
      const r = await bulkManagerAction(rows.map((m) => m.id), action, action === "deactivate" ? reason : undefined);
      if (!r.ok) return void toast.error(te(r.error as "unknown"));
      const { done, skipped } = r.data!;
      toast.success(t(action === "deactivate" ? "bulkDeactivated" : action === "activate" ? "bulkActivated" : "bulkInvited", { count: done.length }));
      if (skipped) toast.warning(t("bulkSkipped", { count: skipped }));
      onDone(
        done,
        action === "deactivate"
          ? { status: "deactivated", deactivationReason: reason.trim() }
          : action === "activate"
            ? { status: "active", deactivationReason: null }
            : null,
      );
      setAsking(false);
      setReason("");
      if (action !== "resend") router.refresh();
    });

  return (
    <>
      <Button size="sm" variant="dangerOutline" disabled={pending || active.length === 0} onClick={() => setAsking(true)}>
        <PowerOff />
        {t("deactivate")} {active.length > 0 && `(${active.length})`}
      </Button>
      <Button size="sm" variant="success" loading={pending} disabled={pending || deactivated.length === 0} onClick={() => run("activate", deactivated)}>
        <Power />
        {t("activate")} {deactivated.length > 0 && `(${deactivated.length})`}
      </Button>
      <Button size="sm" variant="outline" disabled={pending || invited.length === 0} onClick={() => run("resend", invited)}>
        <MailPlus />
        {t("resendInvite")} {invited.length > 0 && `(${invited.length})`}
      </Button>
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent title={t("bulkDeactivateTitle", { count: active.length })} description={t("deactivateBody")} closeLabel={tc("close")}>
          <p className="mb-3 text-sm text-ink-2">{active.map((m) => `${m.firstName} ${m.lastName}`).join(", ")}</p>
          <Field label={t("deactivationReason")} required hint={t("deactivationReasonHint")}>
            {(p) => <Textarea {...p} autoFocus value={reason} onChange={(x) => setReason(x.target.value)} />}
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAsking(false)}>{tc("cancel")}</Button>
            <Button variant="danger" loading={pending} disabled={reason.trim().length < 3} onClick={() => run("deactivate", active)}>
              <PowerOff />
              {t("deactivate")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
