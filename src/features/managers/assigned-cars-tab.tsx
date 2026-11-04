"use client";

import Image from "next/image";
import { CarFront, Check, Plus, Search, Unlink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CarArt } from "@/components/car-art";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge, EmptyState, Panel } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { carState, STATE_TONE } from "@/lib/car-state";
import { cn, formatMoney } from "@/lib/utils";
import { assignCarsToManager, unassignCarFromManager } from "@/server/actions/managers";
import type { FleetRow } from "@/server/queries/fleet";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Onglet « Voitures affectées » de la fiche gestionnaire : voitures dont il est responsable,
 * plus le rappel des voitures partagées (sans gestionnaire = tous). L'administrateur peut
 * affecter plusieurs voitures d'un coup et en retirer.
 */
export function AssignedCarsTab({
  managerId,
  assigned,
  candidates,
  sharedCount,
  canEdit,
  fleetBase,
}: {
  managerId: string;
  assigned: FleetRow[];
  candidates: FleetRow[];
  sharedCount: number;
  canEdit: boolean;
  fleetBase: string;
}) {
  const t = useTranslations("Managers");
  const tf = useTranslations("Fleet");
  const te = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const rows = assigned.filter((r) => !removed.has(r.id));

  const unassign = (carId: string) =>
    start(async () => {
      const r = await unassignCarFromManager(managerId, carId);
      if (r.ok) {
        setRemoved((s) => new Set(s).add(carId));
        toast.success(t("carUnassigned"));
        router.refresh();
      } else toast.error(te(r.error as "unknown"));
    });

  return (
    <Panel className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-ink">{t("assignedCarsTitle", { count: rows.length })}</h2>
          <p className="text-sm text-ink-3">{t("assignedCarsHint", { count: sharedCount })}</p>
        </div>
        {canEdit && (
          <Button onClick={() => setOpen(true)} disabled={candidates.length === 0}>
            <Plus />
            {t("assignCars")}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<CarFront />} title={t("noAssignedCars")} body={t("noAssignedCarsBody")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const s = carState(r);
            return (
              <li key={r.id} className="flex gap-3 rounded-xl border border-mist bg-paper p-3">
                <Link href={`${fleetBase}/fleet/${r.id}`} className="relative grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-chalk">
                  {r.cover ? <Image src={r.cover} alt="" fill sizes="96px" className="object-cover" /> : <CarArt category={r.category} color={r.colorHex} className="w-20" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`${fleetBase}/fleet/${r.id}`} className="block truncate text-sm font-semibold text-ink hover:text-majorelle">
                    {r.brand} {r.model} {r.year}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                    <span dir="ltr" className="rounded border border-mist-2 bg-chalk px-1.5 font-mono">{r.plateNumber}</span>
                    {r.city}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <Badge tone={STATE_TONE[s]} dot>{tf(`state.${s}`)}</Badge>
                    <span className="text-xs font-semibold text-ink-2">{formatMoney(r.dailyPrice, locale)}</span>
                  </div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => unassign(r.id)}
                    title={t("unassignCar")}
                    aria-label={t("unassignCar")}
                    className="grid size-8 shrink-0 place-items-center self-start rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                  >
                    <Unlink className="size-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open && <AssignDialog managerId={managerId} candidates={candidates} onClose={() => setOpen(false)} />}
    </Panel>
  );
}

function AssignDialog({ managerId, candidates, onClose }: { managerId: string; candidates: FleetRow[]; onClose: () => void }) {
  const t = useTranslations("Managers");
  const tf = useTranslations("Fleet");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const list = useMemo(() => {
    const n = norm(q.trim());
    return n ? candidates.filter((c) => norm(`${c.brand} ${c.model} ${c.year} ${c.plateNumber} ${c.city}`).includes(n)) : candidates;
  }, [q, candidates]);
  const allShown = list.length > 0 && list.every((c) => picked.has(c.id));

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const save = () =>
    start(async () => {
      const r = await assignCarsToManager(managerId, [...picked]);
      if (r.ok) {
        toast.success(t("carsAssigned", { count: r.data!.added }));
        router.refresh();
        onClose();
      } else toast.error(te(r.error as "unknown"));
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("assignCars")} description={t("assignCarsBody")} closeLabel={tc("close")} className="max-h-[calc(100dvh-32px)] max-w-2xl overflow-y-auto">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-mist-2 bg-paper px-3 focus-within:border-majorelle">
            <Search className="size-4 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchCars")} aria-label={t("searchCars")} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setPicked((s) => {
                const n = new Set(s);
                for (const c of list) {
                  if (allShown) n.delete(c.id);
                  else n.add(c.id);
                }
                return n;
              })
            }
          >
            {allShown ? t("unselectShown") : t("selectShown")}
          </Button>
        </div>
        <ul className="scroll-thin mt-3 max-h-[50vh] space-y-1 overflow-y-auto">
          {list.map((c) => {
            const on = picked.has(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-pressed={on}
                  className={cn("flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-start transition-colors", on ? "border-majorelle bg-majorelle-soft" : "border-mist hover:bg-chalk")}
                >
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-majorelle bg-majorelle text-white" : "border-mist-2 bg-paper")}>
                    {on && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{c.brand} {c.model} {c.year}</span>
                    <span className="block truncate text-xs text-ink-3">
                      <span dir="ltr" className="font-mono">{c.plateNumber}</span> · {c.city} · {c.managerNames.length ? c.managerNames.join(", ") : tf("allManagers")}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-3">{t("noCarFound")}</li>}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-mist pt-4">
          <span className="text-sm text-ink-3">{t("carsPicked", { count: picked.size })}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
            <Button loading={pending} disabled={picked.size === 0} onClick={save}>
              <Plus />
              {t("assign")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
