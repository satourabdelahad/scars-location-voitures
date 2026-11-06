"use client";

import { Building2, CarFront, Crown, Pencil, Save, Sparkles, Store, Tag, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge, Panel } from "@/components/ui/misc";
import { MultiSelect } from "@/components/ui/multi-select";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { saveManagerPerimeter } from "@/server/actions/managers";
import type { FleetRow } from "@/server/queries/fleet";
import type { CarRule } from "./assigned-cars-tab";

export type AgencyLink = { id: number; label: string; active: boolean; responsible: boolean; member: boolean };

type Delta = { carsAdded: number; carsRemoved: number; agenciesAdded: number; agenciesRemoved: number };

/**
 * Bandeau « Périmètre » de la fiche gestionnaire, en deux lignes :
 * — ses agences (équipe : il reçoit les emails de ces agences) ;
 * — les voitures qu'il suit (règle automatique marques / villes / agences).
 * L'administrateur modifie les deux dans une seule fenêtre ; la liste des voitures,
 * juste en dessous, est recalculée et l'effet (+3 voitures, −1) est affiché.
 */
export function Perimeter({
  managerId,
  links,
  rule,
  candidates,
  canEdit,
  base,
}: {
  managerId: string;
  links: AgencyLink[];
  rule: CarRule | null;
  candidates: FleetRow[];
  canEdit: boolean;
  base: string;
}) {
  const t = useTranslations("Managers");
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState<Delta | null>(null);
  const agencies = links.filter((l) => l.responsible || l.member);
  const label = (id: number) => links.find((l) => l.id === id)?.label ?? `#${id}`;
  const hasRule = Boolean(rule && (rule.brands.length || rule.cities.length || rule.agencies?.length));

  return (
    <Panel className="mb-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-ink">{t("perimeterTitle")}</h2>
          <p className="mt-0.5 text-sm text-ink-3">{t("perimeterHint")}</p>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Pencil />
            {t("perimeterEdit")}
          </Button>
        )}
      </div>

      <dl className="mt-4 grid gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <dt className="flex w-40 shrink-0 items-center gap-2 text-sm font-semibold text-ink-2">
            <Store className="size-4 text-majorelle" />
            {t("perimeterAgencies")}
          </dt>
          <dd className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {agencies.length === 0 && <span className="text-sm text-ink-3">{t("noAgencyLinked")}</span>}
            {agencies.map((l) => (
              <Link key={l.id} href={`${base}/agencies/${l.id}?tab=managers`} className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-paper px-2.5 py-1 text-xs font-semibold text-ink hover:border-majorelle">
                {l.responsible ? <Crown className="size-3.5 text-saffron-ink" /> : <Building2 className="size-3.5 text-ink-3" />}
                {l.label}
                {l.responsible && <span className="font-normal text-ink-3">· {t("agencyResponsible")}</span>}
                {!l.active && <span className="font-normal text-ink-3">· {t("agencyInactive")}</span>}
              </Link>
            ))}
          </dd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className="flex w-40 shrink-0 items-center gap-2 text-sm font-semibold text-ink-2">
            <Sparkles className="size-4 text-majorelle" />
            {t("perimeterCars")}
          </dt>
          <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {!hasRule && <span className="text-sm text-ink-3">{t("perimeterNoRule")}</span>}
            {rule?.brands.map((b) => <Badge key={`b-${b}`} tone="info">{b}</Badge>)}
            {rule?.cities.map((c) => <Badge key={`c-${c}`} tone="dark">{c}</Badge>)}
            {(rule?.agencies ?? []).map((a) => <Badge key={`a-${a}`} tone="success">{label(a)}</Badge>)}
            {hasRule && <span className="text-xs text-ink-3">{t("ruleCount", { count: rule!.carCount })}</span>}
          </dd>
        </div>
      </dl>

      {delta && (delta.carsAdded > 0 || delta.carsRemoved > 0) && (
        <p role="status" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-majorelle-soft px-4 py-2.5 text-sm text-majorelle">
          <CarFront className="size-4" />
          {delta.carsAdded > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-palm">
              <TrendingUp className="size-4" />
              {t("deltaAdded", { count: delta.carsAdded })}
            </span>
          )}
          {delta.carsRemoved > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-danger">
              <TrendingDown className="size-4" />
              {t("deltaRemoved", { count: delta.carsRemoved })}
            </span>
          )}
        </p>
      )}

      {open && <PerimeterDialog managerId={managerId} links={links} rule={rule} candidates={candidates} onClose={() => setOpen(false)} onSaved={setDelta} />}
    </Panel>
  );
}

function PerimeterDialog({
  managerId,
  links,
  rule,
  candidates,
  onClose,
  onSaved,
}: {
  managerId: string;
  links: AgencyLink[];
  rule: CarRule | null;
  candidates: FleetRow[];
  onClose: () => void;
  onSaved: (d: Delta) => void;
}) {
  const t = useTranslations("Managers");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const initialMembers = links.filter((l) => l.member).map((l) => String(l.id));
  const [members, setMembers] = useState<string[]>(initialMembers);
  const [brands, setBrands] = useState<string[]>(rule?.brands ?? []);
  const [cities, setCities] = useState<string[]>(rule?.cities ?? []);
  const [ruleAgencies, setRuleAgencies] = useState<string[]>((rule?.agencies ?? []).map(String));
  const [linkCars, setLinkCars] = useState(true);

  const countBy = (key: "brand" | "city") => {
    const m = new Map<string, number>();
    for (const c of candidates) m.set(c[key], (m.get(c[key]) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr")).map(([value, n]) => ({ value, label: value, count: n }));
  };
  const brandOptions = useMemo(() => countBy("brand"), [candidates]); // eslint-disable-line react-hooks/exhaustive-deps
  const cityOptions = useMemo(() => countBy("city"), [candidates]); // eslint-disable-line react-hooks/exhaustive-deps
  const agencyCarCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of candidates) m.set(String(c.agencyId), (m.get(String(c.agencyId)) ?? 0) + 1);
    return m;
  }, [candidates]);
  const agencyOptions = links.filter((l) => l.active || l.member).map((l) => ({ value: String(l.id), label: l.label, count: agencyCarCount.get(String(l.id)) ?? 0 }));
  const memberOptions = links.filter((l) => !l.responsible && (l.active || l.member)).map((l) => ({ value: String(l.id), label: l.label }));
  const newlyAdded = members.filter((m) => !initialMembers.includes(m));

  const initialRule = (rule?.agencies ?? []).map(String);
  // Agence ajoutée à l'équipe : avec la case cochée, ses voitures sont ajoutées aux voitures suivies.
  const changeMembers = (next: string[]) => {
    const added = next.filter((x) => !members.includes(x) && !initialMembers.includes(x));
    if (linkCars && added.length) setRuleAgencies((r) => [...new Set([...r, ...added])]);
    setMembers(next);
  };
  const toggleLink = (on: boolean) => {
    setLinkCars(on);
    setRuleAgencies((r) => (on ? [...new Set([...r, ...newlyAdded])] : r.filter((x) => !newlyAdded.includes(x) || initialRule.includes(x))));
  };
  const ruleFinal = ruleAgencies;
  // Aperçu : nombre de voitures actives que suivra le gestionnaire avec ces critères.
  const preview = useMemo(() => {
    if (!brands.length && !cities.length && !ruleFinal.length) return 0;
    return candidates.filter(
      (c) => (!brands.length || brands.includes(c.brand)) && (!cities.length || cities.includes(c.city)) && (!ruleFinal.length || ruleFinal.includes(String(c.agencyId))),
    ).length;
  }, [brands, cities, ruleFinal, candidates]);

  const save = () =>
    start(async () => {
      const r = await saveManagerPerimeter(managerId, {
        agencies: members.map(Number),
        brands,
        cities,
        ruleAgencies: ruleFinal.map(Number),
      });
      if (!r.ok) return void toast.error(te(r.error as "unknown"));
      const d = r.data!;
      onSaved(d);
      toast.success(t("perimeterSaved"));
      if (d.emailed) toast.success(t("agenciesMailed", { count: d.emailed }));
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("perimeterEdit")} description={t("perimeterDialogHint")} closeLabel={tc("close")} className="max-h-[calc(100dvh-32px)] max-w-2xl overflow-y-auto">
        <section>
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Store className="size-4 text-majorelle" />
            {t("perimeterAgencies")}
          </h3>
          <p className="mt-0.5 mb-2.5 text-xs text-ink-3">{t("agenciesHint")}</p>
          <MultiSelect
            label={t("perimeterAgencies")}
            icon={<Building2 />}
            options={memberOptions}
            value={members}
            onChange={changeMembers}
            searchPlaceholder={t("searchAgency")}
            allLabel={t("noAgencyChosen")}
            clearLabel={t("clearChoice")}
            emptyLabel={t("noOption")}
          />
          {links.some((l) => l.responsible) && <p className="mt-2 text-xs text-ink-3">{t("responsibleNote")}</p>}
          <label className={cn("mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm", newlyAdded.length ? "cursor-pointer border-majorelle/30 bg-majorelle-soft/60" : "border-mist text-ink-3")}>
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--majorelle)]" disabled={!newlyAdded.length} checked={linkCars} onChange={(e) => toggleLink(e.target.checked)} />
            <span>
              <span className="block font-semibold text-ink">{t("linkAgencyCars")}</span>
              <span className="block text-xs text-ink-3">{t("linkAgencyCarsHint")}</span>
            </span>
          </label>
        </section>

        <section className="mt-6 border-t border-mist pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Sparkles className="size-4 text-majorelle" />
            {t("perimeterCars")}
          </h3>
          <p className="mt-0.5 mb-2.5 text-xs text-ink-3">{t("perimeterCarsHint")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <MultiSelect label={t("byBrand")} icon={<Tag />} options={brandOptions} value={brands} onChange={setBrands} searchPlaceholder={t("searchBrand")} allLabel={t("allBrands")} clearLabel={t("clearChoice")} emptyLabel={t("noOption")} />
            <MultiSelect label={t("byCity")} icon={<Building2 />} options={cityOptions} value={cities} onChange={setCities} searchPlaceholder={t("searchCity")} allLabel={t("allCities")} clearLabel={t("clearChoice")} emptyLabel={t("noOption")} />
            <MultiSelect label={t("byAgency")} icon={<Store />} options={agencyOptions} value={ruleFinal} onChange={setRuleAgencies} searchPlaceholder={t("searchAgency")} allLabel={t("allAgencies")} clearLabel={t("clearChoice")} emptyLabel={t("noOption")} />
          </div>
          <p className="mt-3 text-sm font-semibold text-ink" aria-live="polite">
            {brands.length || cities.length || ruleFinal.length ? t("ruleMatches", { count: preview }) : t("perimeterNoRule")}
          </p>
        </section>

        <div className="mt-5 flex justify-end gap-2 border-t border-mist pt-4">
          <Button variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
          <Button loading={pending} onClick={save}>
            <Save />
            {t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
