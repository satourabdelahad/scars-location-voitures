"use client";

import { Ban, Building2, CalendarPlus, Download, ListChecks, CarFront, CheckCircle2, Handshake, KeyRound, LogIn, LogOut, Mail, Pencil, PlusCircle, Power, ShieldCheck, StickyNote, Undo2, UserCheck, UserPlus, UserRound, Wrench, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Timeline } from "@/components/timeline";
import { Badge, Panel, type Tone } from "@/components/ui/misc";
import { useViewMode, ViewToggle } from "@/components/view-toggle";
import { intlLocale } from "@/i18n/config";
import { cn, formatDateTime } from "@/lib/utils";
import type { DealType } from "@/db/schema";
import type { ActivityGroup, ActivityRow } from "@/server/queries/manager-profile";

const GROUPS: ActivityGroup[] = ["session", "agencies", "fleet", "reservations", "clients", "deals", "profile", "exports"];

const STYLE: Record<string, { icon: ReactNode; tone: string; badge: Tone }> = {
  session_login: { icon: <LogIn />, tone: "bg-palm-soft text-palm", badge: "success" },
  session_logout: { icon: <LogOut />, tone: "bg-mist text-ink-2", badge: "neutral" },
  car_create: { icon: <PlusCircle />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  car_update: { icon: <Pencil />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  car_deactivate: { icon: <Ban />, tone: "bg-danger-soft text-danger", badge: "danger" },
  car_repair_start: { icon: <Wrench />, tone: "bg-saffron/20 text-saffron-ink", badge: "warning" },
  car_repair_end: { icon: <CheckCircle2 />, tone: "bg-palm-soft text-palm", badge: "success" },
  client_create: { icon: <UserPlus />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  client_update: { icon: <Pencil />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  appointment_create: { icon: <CalendarPlus />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  reservation_confirm: { icon: <CheckCircle2 />, tone: "bg-palm-soft text-palm", badge: "success" },
  reservation_reject: { icon: <XCircle />, tone: "bg-danger-soft text-danger", badge: "danger" },
  reservation_pickup: { icon: <KeyRound />, tone: "bg-ink text-chalk", badge: "dark" },
  reservation_return: { icon: <Undo2 />, tone: "bg-palm-soft text-palm", badge: "success" },
  reservation_cancel: { icon: <Ban />, tone: "bg-danger-soft text-danger", badge: "danger" },
  deal_create: { icon: <Handshake />, tone: "bg-saffron/20 text-saffron-ink", badge: "warning" },
  deal_update: { icon: <Handshake />, tone: "bg-saffron/20 text-saffron-ink", badge: "warning" },
  deal_note: { icon: <StickyNote />, tone: "bg-saffron/20 text-saffron-ink", badge: "warning" },
  client_deactivate: { icon: <Ban />, tone: "bg-danger-soft text-danger", badge: "danger" },
  client_reactivate: { icon: <Power />, tone: "bg-palm-soft text-palm", badge: "success" },
  profile_created: { icon: <UserPlus />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  profile_updated: { icon: <Pencil />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  profile_deactivated: { icon: <Ban />, tone: "bg-danger-soft text-danger", badge: "danger" },
  profile_reactivated: { icon: <Power />, tone: "bg-palm-soft text-palm", badge: "success" },
  profile_activated: { icon: <UserCheck />, tone: "bg-palm-soft text-palm", badge: "success" },
  manager_assign_cars: { icon: <CarFront />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  manager_unassign_car: { icon: <CarFront />, tone: "bg-mist text-ink-2", badge: "neutral" },
  manager_assign_rule: { icon: <CarFront />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  manager_agencies: { icon: <Building2 />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  car_bulk_promo: { icon: <ListChecks />, tone: "bg-saffron/20 text-saffron-ink", badge: "warning" },
  car_promo: { icon: <CarFront />, tone: "bg-saffron/20 text-saffron-ink", badge: "warning" },
  marketing_send: { icon: <Mail />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  manager_clear_rule: { icon: <CarFront />, tone: "bg-mist text-ink-2", badge: "neutral" },
  agency_create: { icon: <Building2 />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  agency_update: { icon: <Pencil />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  agency_deactivate: { icon: <Ban />, tone: "bg-danger-soft text-danger", badge: "danger" },
  agency_reactivate: { icon: <Power />, tone: "bg-palm-soft text-palm", badge: "success" },
  export_table: { icon: <Download />, tone: "bg-mist text-ink-2", badge: "neutral" },
  export_record: { icon: <Download />, tone: "bg-mist text-ink-2", badge: "neutral" },
  manager_bulk_deactivate: { icon: <ListChecks />, tone: "bg-danger-soft text-danger", badge: "danger" },
  manager_bulk_activate: { icon: <ListChecks />, tone: "bg-palm-soft text-palm", badge: "success" },
  manager_bulk_resend: { icon: <ListChecks />, tone: "bg-majorelle-soft text-majorelle", badge: "info" },
  security_password_change: { icon: <KeyRound />, tone: "bg-saffron/20 text-saffron-ink", badge: "warning" },
  manager_password_set: { icon: <KeyRound />, tone: "bg-saffron/20 text-saffron-ink", badge: "warning" },
  security_unlock: { icon: <ShieldCheck />, tone: "bg-palm-soft text-palm", badge: "success" },
};
const fallbackStyle = { icon: <UserRound />, tone: "bg-mist text-ink-2", badge: "neutral" as Tone };

/**
 * Onglet "Historique" : connexions, parc, réservations, clients, deals et fiche, en tableau ou en frise,
 * avec l'auteur de chaque événement. `global` : historique de toute l'équipe (page Historique de l'administrateur).
 */
export function HistoryTab({ rows, global = false, tableKey = "manager-history" }: { rows: ActivityRow[]; global?: boolean; tableKey?: string }) {
  const t = useTranslations("Activity");
  const tm = useTranslations("Managers");
  const td = useTranslations("Deals");
  const tb = useTranslations("Back");
  const locale = useLocale();
  const [mode, setMode] = useViewMode("manager-history", "timeline");
  const [group, setGroup] = useState<ActivityGroup | "all">("all");

  const label = (r: ActivityRow) => {
    const params = { car: r.car ?? "—", ref: r.reference ?? "—", name: r.dealName ?? "—" };
    const base = t.has(r.kind as "session_login") ? t(r.kind as "session_login", params) : r.kind;
    // Événements de fiche : on précise de quel gestionnaire il s'agit dans l'historique de l'équipe.
    return global && r.group === "profile" && r.kind.startsWith("profile_") && r.dealName ? `${base} : ${r.dealName}` : base;
  };
  const roleLabel = (r: ActivityRow) => (r.actorRole === "admin" ? tb("roleAdmin") : r.actorRole === "manager" ? tb("roleManager") : "");
  const author = (r: ActivityRow) => (r.actorName ? `${r.actorName}${roleLabel(r) ? ` (${roleLabel(r)})` : ""}` : "—");
  const detail = (r: ActivityRow) => {
    if (r.kind === "session_login" && r.provider) return t("via", { provider: r.provider === "credentials" ? t("password") : r.provider });
    if (r.kind === "deal_update" && r.fromType && r.toType) return `${td(`types.${r.fromType as DealType}`)} → ${td(`types.${r.toType as DealType}`)}`;
    if (r.kind === "deal_create" && r.toType) return td(`types.${r.toType as DealType}`);
    if (r.detail === "car_unavailable") return null;
    return r.detail;
  };

  const filtered = useMemo(() => (group === "all" ? rows : rows.filter((r) => r.group === group)), [rows, group]);
  const counts = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g, rows.filter((r) => r.group === g).length])), [rows]);

  const columns = useMemo<Column<ActivityRow>[]>(
    () => [
      { id: "at", header: t("date"), text: (r) => formatDateTime(r.at, locale), sortValue: (r) => r.at, minWidth: 170 },
      {
        id: "group",
        header: t("type"),
        text: (r) => t(`group.${r.group}`),
        filter: { type: "select", options: GROUPS.map((g) => ({ value: g, label: t(`group.${g}`) })) },
        cell: (r) => <Badge tone={(STYLE[r.kind] ?? fallbackStyle).badge}>{t(`group.${r.group}`)}</Badge>,
      },
      {
        id: "event",
        header: t("event"),
        text: (r) => label(r),
        filter: { type: "text" },
        cell: (r) => (
          <span className="flex items-center gap-2 font-medium text-ink">
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full [&_svg]:size-3.5", (STYLE[r.kind] ?? fallbackStyle).tone)}>{(STYLE[r.kind] ?? fallbackStyle).icon}</span>
            {label(r)}
          </span>
        ),
      },
      {
        id: "actor",
        header: t("by"),
        addedLater: true,
        text: (r) => author(r),
        filter: { type: "text" },
        cell: (r) =>
          r.actorName ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-ink">{r.actorName}</span>
              {r.actorRole && <Badge tone={r.actorRole === "admin" ? "dark" : "info"}>{roleLabel(r)}</Badge>}
            </span>
          ) : (
            "—"
          ),
      },
      { id: "detail", header: t("details"), text: (r) => detail(r) ?? "", filter: { type: "text" } },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, td, tb, locale, global],
  );

  const month = new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t("type")} className="scroll-thin flex gap-1.5 overflow-x-auto">
          {(["all", ...GROUPS] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={group === g}
              onClick={() => setGroup(g)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors",
                group === g ? "border-ink bg-ink text-chalk" : "border-mist-2 bg-paper text-ink-2 hover:border-ink-3",
              )}
            >
              {g === "all" ? t("all") : t(`group.${g}`)}
              <span className={cn("rounded-full px-1.5 text-[11px] tabular", group === g ? "bg-white/20" : "bg-mist")}>{g === "all" ? rows.length : counts[g]}</span>
            </button>
          ))}
        </div>
        <ViewToggle mode={mode} onChange={setMode} />
      </div>

      {mode === "table" ? (
        <DataTable tableKey={tableKey} columns={columns} data={filtered} exportTitle={tm("tabHistory")} exportFilename="historique" />
      ) : (
        <Panel className="p-6">
          <Timeline
            monthLabel={(iso) => month.format(new Date(iso))}
            empty={t("empty")}
            items={filtered.map((r) => {
              const st = STYLE[r.kind] ?? fallbackStyle;
              const d = detail(r);
              return {
                id: r.id,
                at: r.at,
                icon: st.icon,
                tone: st.tone,
                title: label(r),
                meta: r.actorName ? `${formatDateTime(r.at, locale)} · ${t("byName", { name: author(r) })}` : formatDateTime(r.at, locale),
                detail: d ? <span className={r.group === "profile" ? "" : "text-ink-3"}>{d}</span> : null,
                aside: <Badge tone={st.badge}>{t(`group.${r.group}`)}</Badge>,
              };
            })}
          />
        </Panel>
      )}
    </div>
  );
}
