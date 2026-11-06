"use client";

import { Building2, Check, Crown, Plane, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Panel } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { setManagerAgencies } from "@/server/actions/managers";
import type { AgencyLink } from "./perimeter";

/**
 * Onglet « Agences » de la fiche gestionnaire / administrateur : les agences auxquelles il est
 * rattaché (équipe, emails de l'agence). L'administrateur les choisit ; il appartient lui-même
 * à toutes les agences. Le responsable d'une agence en fait toujours partie.
 */
export function AgenciesTab({ managerId, links, canEdit, isAdminTarget, base }: { managerId: string; links: AgencyLink[]; canEdit: boolean; isAdminTarget: boolean; base: string }) {
  const t = useTranslations("Managers");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const initial = links.filter((l) => l.member).map((l) => l.id);
  const [picked, setPicked] = useState<Set<number>>(new Set(initial));
  const [linkCars, setLinkCars] = useState(true);
  const editable = canEdit && !isAdminTarget;
  const shown = editable ? links.filter((l) => l.active || l.member || l.responsible) : links.filter((l) => l.member || l.responsible);
  const added = [...picked].filter((id) => !initial.includes(id));
  const dirty = added.length > 0 || initial.some((id) => !picked.has(id));

  const toggle = (id: number) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const save = () =>
    start(async () => {
      const r = await setManagerAgencies(managerId, [...picked], { linkCars });
      if (!r.ok) return void toast.error(te(r.error as "unknown"));
      const d = r.data!;
      toast.success(t("agenciesSaved"));
      if (d.emailed) toast.success(t("agenciesMailed", { count: d.emailed }));
      if (d.carsAdded) toast.success(t("deltaAdded", { count: d.carsAdded }));
      router.refresh();
    });

  return (
    <Panel className="p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="font-bold text-ink">{t("agenciesTitle")}</h2>
        <p className="mt-0.5 text-sm text-ink-3">{isAdminTarget ? t("adminAllAgencies") : editable ? t("agenciesHint") : t("agenciesHintReadOnly")}</p>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<Building2 />} title={t("noAgencyLinked")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((l) => {
            const on = isAdminTarget || l.responsible || picked.has(l.id);
            const locked = !editable || l.responsible;
            const body = (
              <>
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-majorelle bg-majorelle text-white" : "border-mist-2 bg-paper")}>{on && <Check className="size-3.5" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
                    {l.airport && <Plane className="size-3.5 shrink-0 text-majorelle" />}
                    {l.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">
                    {t("agencyCars", { count: l.cars ?? 0 })}
                    {l.head ? ` · ${t("headLabel", { name: l.head })}` : ""}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {l.responsible && <Badge tone="warning"><Crown className="me-1 inline size-3" />{t("agencyResponsible")}</Badge>}
                    {!l.active && <Badge tone="neutral">{t("agencyInactive")}</Badge>}
                  </span>
                </span>
              </>
            );
            return (
              <li key={l.id}>
                {locked ? (
                  <Link href={`${base}/agencies/${l.id}?tab=managers`} className={cn("flex h-full items-start gap-3 rounded-xl border px-3.5 py-3 hover:border-majorelle", on ? "border-majorelle/40 bg-majorelle-soft/50" : "border-mist")}>
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(l.id)}
                    className={cn("flex h-full w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-start transition-colors", on ? "border-majorelle bg-majorelle-soft" : "border-mist hover:bg-chalk")}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editable && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-mist pt-4">
          <label className={cn("flex items-start gap-2.5 text-sm", added.length ? "cursor-pointer" : "text-ink-3")}>
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--majorelle)]" disabled={!added.length} checked={linkCars} onChange={(e) => setLinkCars(e.target.checked)} />
            <span>
              <span className="block font-semibold text-ink">{t("linkAgencyCars")}</span>
              <span className="block text-xs text-ink-3">{t("linkAgencyCarsHint")}</span>
            </span>
          </label>
          <Button onClick={save} loading={pending} disabled={!dirty}>
            <Save />
            {t("save")}
          </Button>
        </div>
      )}
    </Panel>
  );
}
