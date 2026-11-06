"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban, Building2, Percent, Power, UserPlus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useRowPatches } from "@/components/data-table/use-row-patches";
import { bulkFleetAction } from "@/server/actions/fleet";
import { cn } from "@/lib/utils";
import { CarArt } from "@/components/car-art";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { carCategoryEnum, fuelEnum, transmissionEnum } from "@/db/schema";
import { formatDate, formatMoney } from "@/lib/utils";
import type { FleetRow } from "@/server/queries/fleet";
import { CAR_STATES, carState, STATE_TONE } from "@/lib/car-state";
import { promoState } from "@/lib/car-promo";
import { todayISO } from "@/lib/utils";

type BulkOptions = { agencies: { id: number; city: string; name: string }[]; managers: { id: string; name: string; city: string }[]; canAssign: boolean };

export function FleetTable({
  rows: serverRows,
  base,
  prefs,
  tableKey = "fleet",
  bulk,
}: {
  rows: FleetRow[];
  base: string;
  prefs: { visibleColumns: string[]; pageSize: number } | null;
  tableKey?: string;
  /** Actions groupées (page Parc automobile) */
  bulk?: BulkOptions;
}) {
  const [rows, patch] = useRowPatches(serverRows);
  const agencyOptions = useMemo(
    () => [...new Set(serverRows.map((r) => `${r.city}, ${r.agencyName}`))].sort((a, b) => a.localeCompare(b, "fr")).map((v) => ({ value: v, label: v })),
    [serverRows],
  );
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
      {
        id: "managers",
        header: t("managers"),
        addedLater: true,
        text: (r) => (r.managerNames.length ? r.managerNames.join(", ") : t("allManagers")),
        filter: { type: "text" },
        cell: (r) =>
          r.managerNames.length ? (
            <span className="text-ink-2">{r.managerNames.join(", ")}</span>
          ) : (
            <Badge tone="neutral">{t("allManagers")}</Badge>
          ),
      },
      // Agence de rattachement : filtre par liste de choix
      { id: "city", header: t("agency"), text: (r) => `${r.city}, ${r.agencyName}`, filter: { type: "select", options: agencyOptions } },
      { id: "mileage", header: t("mileage"), text: (r) => `${r.mileage.toLocaleString(locale)} km`, sortValue: (r) => r.mileage, align: "end", defaultHidden: true },
      { id: "dailyPrice", header: t("dailyPrice"), text: (r) => formatMoney(r.dailyPrice, locale), sortValue: (r) => r.dailyPrice, align: "end", filter: { type: "text" } },
      {
        id: "promo",
        header: t("promoColumn"),
        addedLater: true,
        text: (r) => (r.promoPercent ? `-${r.promoPercent} %` : ""),
        sortValue: (r) => r.promoPercent ?? 0,
        filter: { type: "text" },
        cell: (r) => {
          const st = promoState(r, todayISO());
          if (st === "none") return "";
          return (
            <span title={[r.promoStartsOn && formatDate(r.promoStartsOn, locale), r.promoEndsOn && formatDate(r.promoEndsOn, locale)].filter(Boolean).join(" → ")}>
              <Badge tone={st === "active" ? "warning" : "neutral"}>
                -{r.promoPercent} %{st !== "active" && ` · ${t(`promoState.${st}`)}`}
              </Badge>
            </span>
          );
        },
      },
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
        text: (r) => t(`state.${carState(r)}`),
        filter: { type: "select", options: CAR_STATES.map((s) => ({ value: t(`state.${s}`), label: t(`state.${s}`) })) },
        cell: (r) => {
          const s = carState(r);
          return (
            <Badge tone={STATE_TONE[s]} dot>
              {t(`state.${s}`)}
              {s === "deactivated" && ` (${e(`carDeactivation.${r.deactivationReason ?? "other"}`)})`}
            </Badge>
          );
        },
      },
    ],
    [t, e, ts, c, locale, base, agencyOptions],
  );

  return (
    <DataTable
      tableKey={tableKey}
      columns={columns}
      data={rows}
      initialPrefs={prefs}
      exportTitle={t("title")}
      exportFilename="parc-automobile"
      rowClassName={(r) => (r.status === "deactivated" ? "opacity-55" : undefined)}
      onRowClick={(r) => router.push(`${base}/fleet/${r.id}`)}
      bulkActions={
        bulk
          ? (selected, clear) => (
              <FleetBulkActions
                selected={selected}
                options={bulk}
                onDone={(ids, next) => {
                  if (next) patch(ids, next);
                  clear();
                }}
              />
            )
          : undefined
      }
    />
  );
}

const REASONS = ["stolen", "sold", "totaled", "accident", "end_of_lease", "other"] as const;
type BulkAction = "deactivate" | "activate" | "repair" | "assign" | "agency" | "promo";

/** Actions groupées du parc : désactiver, remettre en service, mettre en réparation, affecter, rattacher à une agence. */
function FleetBulkActions({ selected, options, onDone }: { selected: FleetRow[]; options: BulkOptions; onDone: (ids: string[], next: Partial<FleetRow> | null) => void }) {
  const t = useTranslations("Fleet");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const e = useTranslations("Enums");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<BulkAction | null>(null);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("sold");
  const [note, setNote] = useState("");
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [agencyId, setAgencyId] = useState("");
  const [promo, setPromo] = useState({ remove: false, percent: "10", startsOn: "", endsOn: "" });
  const promoOk = promo.remove || (Number(promo.percent) >= 1 && Number(promo.percent) <= 90 && (!promo.startsOn || !promo.endsOn || promo.endsOn >= promo.startsOn));
  const live = selected.filter((r) => r.status !== "deactivated");
  const inRepair = selected.filter((r) => r.status === "maintenance");
  const active = selected.filter((r) => r.status === "active");

  const run = (action: BulkAction, rows: FleetRow[]) =>
    start(async () => {
      const r = await bulkFleetAction(
        rows.map((x) => x.id),
        action,
        action === "deactivate"
          ? { reason, note }
          : action === "assign"
            ? { managerIds }
            : action === "agency"
              ? { agencyId: Number(agencyId) }
              : action === "promo"
                ? { promo: promo.remove ? null : { percent: Number(promo.percent), startsOn: promo.startsOn || null, endsOn: promo.endsOn || null } }
                : {},
      );
      if (!r.ok) return void toast.error(te(r.error as "unknown"));
      const { done, skipped } = r.data!;
      toast.success(t(`bulkDone.${action}`, { count: done.length }));
      if (skipped) toast.warning(t("bulkSkipped", { count: skipped }));
      const agency = options.agencies.find((a) => String(a.id) === agencyId);
      onDone(
        done,
        action === "deactivate"
          ? { status: "deactivated", deactivationReason: reason }
          : action === "activate"
            ? { status: "active" }
            : action === "repair"
              ? { status: "maintenance" }
              : action === "agency" && agency
                ? { agencyId: agency.id, city: agency.city, agencyName: agency.name }
                : action === "promo"
                  ? promo.remove
                    ? { promoPercent: null, promoStartsOn: null, promoEndsOn: null }
                    : { promoPercent: Number(promo.percent), promoStartsOn: promo.startsOn || null, promoEndsOn: promo.endsOn || null }
                  : action === "assign"
                  ? { managerNames: [...new Set([...(rows[0]?.managerNames ?? []), ...options.managers.filter((m) => managerIds.includes(m.id)).map((m) => m.name)])] }
                  : null,
      );
      setDialog(null);
      setNote("");
      setManagerIds([]);
      router.refresh();
    });

  return (
    <>
      <Button size="sm" variant="dangerOutline" disabled={pending || live.length === 0} onClick={() => setDialog("deactivate")}>
        <Ban />
        {t("deactivate")} {live.length > 0 && `(${live.length})`}
      </Button>
      <Button size="sm" variant="success" disabled={pending || inRepair.length === 0} onClick={() => run("activate", inRepair)}>
        <Power />
        {t("bulkActivate")} {inRepair.length > 0 && `(${inRepair.length})`}
      </Button>
      <Button size="sm" variant="outline" disabled={pending || active.length === 0} onClick={() => run("repair", active)}>
        <Wrench />
        {t("bulkRepair")} {active.length > 0 && `(${active.length})`}
      </Button>
      {options.canAssign && (
        <Button size="sm" variant="outline" disabled={pending || live.length === 0} onClick={() => setDialog("assign")}>
          <UserPlus />
          {t("bulkAssign")}
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={pending || live.length === 0} onClick={() => setDialog("agency")}>
        <Building2 />
        {t("bulkAgency")}
      </Button>
      <Button size="sm" variant="outline" disabled={pending || live.length === 0} onClick={() => setDialog("promo")}>
        <Percent />
        {t("bulkPromo")}
      </Button>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent
          title={
            dialog === "deactivate"
              ? t("bulkDeactivateTitle", { count: live.length })
              : dialog === "assign"
                ? t("bulkAssignTitle", { count: live.length })
                : dialog === "promo"
                  ? t("bulkPromoTitle", { count: live.length })
                  : t("bulkAgencyTitle", { count: live.length })
          }
          description={dialog === "deactivate" ? t("deactivateBody") : undefined}
          closeLabel={tc("close")}
        >
          <p className="mb-3 text-sm text-ink-2">{live.map((r) => `${r.brand} ${r.model} (${r.plateNumber})`).join(", ")}</p>
          {dialog === "deactivate" && (
            <div className="space-y-4">
              <Field label={t("deactivationReason")} required>
                {(p) => (
                  <Select {...p} value={reason} onChange={(x) => setReason(x.target.value as (typeof REASONS)[number])}>
                    {REASONS.map((r) => <option key={r} value={r}>{e(`carDeactivation.${r}`)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label={t("deactivationNote")} optionalLabel={tc("optional")}>
                {(p) => <Textarea {...p} rows={3} value={note} onChange={(x) => setNote(x.target.value)} />}
              </Field>
            </div>
          )}
          {dialog === "assign" && (
            <div className="scroll-thin max-h-72 space-y-1 overflow-y-auto">
              {options.managers.map((m) => {
                const on = managerIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setManagerIds((ids) => (on ? ids.filter((x) => x !== m.id) : [...ids, m.id]))}
                    className={cn("flex w-full items-center justify-between rounded-xl border px-3 py-2 text-start text-sm", on ? "border-majorelle bg-majorelle-soft font-semibold text-majorelle" : "border-mist hover:bg-chalk")}
                  >
                    {m.name}
                    <span className="text-xs text-ink-3">{m.city}</span>
                  </button>
                );
              })}
            </div>
          )}
          {dialog === "agency" && (
            <Field label={t("agency")} required>
              {(p) => (
                <Select {...p} value={agencyId} onChange={(x) => setAgencyId(x.target.value)}>
                  <option value="">—</option>
                  {options.agencies.map((a) => <option key={a.id} value={a.id}>{a.city} : {a.name}</option>)}
                </Select>
              )}
            </Field>
          )}
          {dialog === "promo" && <PromoFields value={promo} onChange={setPromo} />}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>{tc("cancel")}</Button>
            <Button
              variant={dialog === "deactivate" ? "danger" : "primary"}
              loading={pending}
              disabled={(dialog === "assign" && managerIds.length === 0) || (dialog === "agency" && !agencyId) || (dialog === "promo" && !promoOk)}
              onClick={() => dialog && run(dialog, live)}
            >
              {tc("confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type PromoValue = { remove: boolean; percent: string; startsOn: string; endsOn: string };

/** Champs d'une promotion (action groupée) : remise en %, dates facultatives, ou retrait de la promotion. */
function PromoFields({ value, onChange }: { value: PromoValue; onChange: (v: PromoValue) => void }) {
  const t = useTranslations("Fleet");
  const tc = useTranslations("Common");
  const set = (patch: Partial<PromoValue>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div role="radiogroup" className="grid grid-cols-2 gap-2">
        {[false, true].map((remove) => (
          <button
            key={String(remove)}
            type="button"
            role="radio"
            aria-checked={value.remove === remove}
            onClick={() => set({ remove })}
            className={cn("rounded-xl border px-3 py-2 text-sm font-semibold", value.remove === remove ? "border-majorelle bg-majorelle-soft text-majorelle" : "border-mist text-ink-2 hover:bg-chalk")}
          >
            {remove ? t("promoRemove") : t("promoApplyOption")}
          </button>
        ))}
      </div>
      {!value.remove && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("promoPercent")} required>
            {(p) => <Input {...p} type="number" min={1} max={90} inputMode="numeric" value={value.percent} onChange={(e) => set({ percent: e.target.value })} />}
          </Field>
          <Field label={t("promoStartsOn")} optionalLabel={tc("optional")}>
            {(p) => <Input {...p} type="date" value={value.startsOn} onChange={(e) => set({ startsOn: e.target.value })} />}
          </Field>
          <Field label={t("promoEndsOn")} optionalLabel={tc("optional")}>
            {(p) => <Input {...p} type="date" min={value.startsOn || undefined} value={value.endsOn} onChange={(e) => set({ endsOn: e.target.value })} />}
          </Field>
        </div>
      )}
      <p className="text-xs text-ink-3">{t("promoHint")}</p>
    </div>
  );
}
