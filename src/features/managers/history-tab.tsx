"use client";

import { Ban, CalendarPlus, CheckCircle2, Handshake, KeyRound, LogIn, LogOut, Pencil, PlusCircle, StickyNote, Undo2, UserPlus, UserRound, Wrench, XCircle } from "lucide-react";
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

const GROUPS: ActivityGroup[] = ["session", "fleet", "reservations", "clients", "deals", "profile"];

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
};
const fallbackStyle = { icon: <UserRound />, tone: "bg-mist text-ink-2", badge: "neutral" as Tone };

/** Onglet "Historique" : connexions, parc, réservations, deals et fiche, en tableau ou en frise. */
export function HistoryTab({ rows }: { rows: ActivityRow[] }) {
  const t = useTranslations("Activity");
  const tm = useTranslations("Managers");
  const td = useTranslations("Deals");
  const locale = useLocale();
  const [mode, setMode] = useViewMode("manager-history", "timeline");
  const [group, setGroup] = useState<ActivityGroup | "all">("all");

  const label = (r: ActivityRow) => {
    const params = { car: r.car ?? "—", ref: r.reference ?? "—", name: r.dealName ?? "—" };
    return t.has(r.kind as "session_login") ? t(r.kind as "session_login", params) : r.kind;
  };
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
      { id: "detail", header: t("details"), text: (r) => detail(r) ?? "", filter: { type: "text" } },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, td, locale],
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
        <DataTable tableKey="manager-history" columns={columns} data={filtered} exportTitle={tm("tabHistory")} exportFilename="historique" />
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
                meta: formatDateTime(r.at, locale),
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
