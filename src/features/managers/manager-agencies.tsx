"use client";

import { Building2, Crown, Save, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Panel } from "@/components/ui/misc";
import { MultiSelect } from "@/components/ui/multi-select";
import { Link, useRouter } from "@/i18n/navigation";
import { setManagerAgencies } from "@/server/actions/managers";

export type AgencyLink = { id: number; label: string; active: boolean; responsible: boolean; member: boolean };

/**
 * « Agences du gestionnaire » (onglet Affectation et voitures) : agences dont il est responsable
 * et agences où il est rattaché. L'administrateur choisit les agences ; les gestionnaires des
 * agences ajoutées reçoivent un email.
 */
export function ManagerAgencies({ managerId, links, canEdit, base }: { managerId: string; links: AgencyLink[]; canEdit: boolean; base: string }) {
  const t = useTranslations("Managers");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const initial = links.filter((l) => l.member).map((l) => String(l.id));
  const [value, setValue] = useState<string[]>(initial);
  const responsible = links.filter((l) => l.responsible);
  const shown = links.filter((l) => l.responsible || value.includes(String(l.id)));
  const dirty = value.slice().sort().join() !== initial.slice().sort().join();

  const save = () =>
    start(async () => {
      const r = await setManagerAgencies(managerId, value.map(Number));
      if (!r.ok) return void toast.error(te(r.error as "unknown"));
      toast.success(r.data!.emailed ? t("agenciesSavedMailed", { count: r.data!.emailed }) : t("agenciesSaved"));
      router.refresh();
    });

  return (
    <Panel className="mb-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-ink">
            <Store className="size-4 text-majorelle" />
            {t("agenciesTitle")}
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">{canEdit ? t("agenciesHint") : t("agenciesHintReadOnly")}</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-72 max-w-full">
              <MultiSelect
                label={t("agenciesTitle")}
                icon={<Building2 />}
                options={links.filter((l) => !l.responsible && (l.active || l.member)).map((l) => ({ value: String(l.id), label: l.label }))}
                value={value}
                onChange={setValue}
                searchPlaceholder={t("searchAgency")}
                allLabel={t("noAgencyChosen")}
                clearLabel={t("clearChoice")}
                emptyLabel={t("noOption")}
              />
            </div>
            <Button onClick={save} loading={pending} disabled={!dirty}>
              <Save />
              {t("save")}
            </Button>
          </div>
        )}
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {shown.length === 0 && <li className="text-sm text-ink-3">{t("noAgencyLinked")}</li>}
        {shown.map((l) => (
          <li key={l.id}>
            <Link href={`${base}/agencies/${l.id}?tab=managers`} className="inline-flex items-center gap-2 rounded-full border border-mist bg-paper px-3 py-1.5 text-sm font-medium text-ink hover:border-majorelle">
              {l.responsible ? <Crown className="size-3.5 text-saffron-ink" /> : <Building2 className="size-3.5 text-ink-3" />}
              {l.label}
              {l.responsible && <Badge tone="warning">{t("agencyResponsible")}</Badge>}
              {!l.active && <Badge tone="neutral">{t("agencyInactive")}</Badge>}
            </Link>
          </li>
        ))}
      </ul>
      {responsible.length > 0 && canEdit && <p className="mt-3 text-xs text-ink-3">{t("responsibleNote")}</p>}
    </Panel>
  );
}
