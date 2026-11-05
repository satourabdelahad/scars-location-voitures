"use client";

import { Save, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { CityCombobox, SuggestCombobox } from "@/components/ui/city-combobox";
import { Link } from "@/i18n/navigation";
import { ManagerAvatar } from "@/features/managers/manager-avatar";
import { PhoneInput } from "@/components/ui/phone-input";
import { useRouter } from "@/i18n/navigation";
import { createAgency, updateAgency } from "@/server/actions/agencies";

export type AgencyValues = {
  name: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  isAirport: boolean;
  /** Responsable : compte gestionnaire */
  managerId: string;
};
export type ManagerChoice = { id: string; firstName: string; lastName: string; civility: "male" | "female"; email: string | null; phone: string; photoUrl: string | null; active: boolean };
const EMPTY: AgencyValues = { name: "", city: "", address: "", phone: "", whatsapp: "", isAirport: false, managerId: "" };

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-mist py-8 first:pt-0 last:border-0 grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {hint && <p className="mt-1 text-sm text-ink-3">{hint}</p>}
      </div>
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Ajout / modification d'une agence : toutes les informations sont obligatoires. */
/**
 * section : "all" (création), "infos" ou "manager" (onglets de la page agence).
 * Chaque onglet enregistre l'agence complète, les autres valeurs restant inchangées.
 */
export function AgencyForm({
  base,
  agencyId,
  initial,
  actions,
  readOnly = false,
  section = "all",
  managers,
}: {
  base: string;
  agencyId?: number;
  initial?: Partial<AgencyValues>;
  actions?: ReactNode;
  readOnly?: boolean;
  section?: "all" | "infos" | "manager";
  managers: ManagerChoice[];
}) {
  const t = useTranslations("Agencies");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [v, setV] = useState<AgencyValues>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof AgencyValues>(k: K, value: AgencyValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const err = (k: string) => (errors[k] ? te(errors[k] as "required") : undefined);

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (readOnly) return;
    setErrors({});
    start(async () => {
      const res = agencyId ? await updateAgency(agencyId, v) : await createAgency(v);
      if (res.ok) {
        toast.success(agencyId ? t("updated") : t("created"));
        if (agencyId) router.refresh();
        else router.push(`${base}/agencies/${(res.data as { id: number }).id}`);
      } else {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          // Champ à corriger dans l'autre onglet : on le dit clairement.
          const infos = ["name", "city", "address", "phone", "whatsapp"];
          const keys = Object.keys(res.fieldErrors);
          if (section === "manager" && keys.some((k) => infos.includes(k))) return void toast.error(t("fixInfosTab"));
          if (section === "infos" && keys.includes("managerId")) return void toast.error(t("fixManagerTab"));
        }
        toast.error(te(res.error as "unknown"));
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-mist bg-paper p-6 sm:p-8">
      {actions && <div className="mb-6 flex flex-wrap justify-end gap-2 border-b border-mist pb-5">{actions}</div>}
      <fieldset disabled={readOnly} className="contents">
        {section !== "manager" && (
          <>
        <Section title={t("agency")}>
          <Field label={t("name")} required error={err("name")}>{(p) => <Input {...p} value={v.name} onChange={(x) => set("name", x.target.value)} />}</Field>
          <Field label={t("city")} required error={err("city")}>{(p) => <CityCombobox {...p} disabled={readOnly} value={v.city} onChange={(c) => set("city", c)} />}</Field>
          <Field label={t("address")} required error={err("address")} className="sm:col-span-2">{(p) => <Input {...p} value={v.address} onChange={(x) => set("address", x.target.value)} />}</Field>
          <Field label={t("phone")} required error={err("phone")}>{(p) => <PhoneInput {...p} value={v.phone} onChange={(x) => set("phone", x)} />}</Field>
          <Field label={t("whatsapp")} required error={err("whatsapp")}>{(p) => <PhoneInput {...p} value={v.whatsapp} onChange={(x) => set("whatsapp", x)} />}</Field>
          <div className="sm:col-span-2">
            <Checkbox label={t("isAirport")} checked={v.isAirport} onChange={(x) => set("isAirport", x.target.checked)} />
          </div>
        </Section>
          </>
        )}
        {section !== "infos" && <ResponsibleSection managers={managers} value={v.managerId} onChange={(id) => set("managerId", id)} error={err("managerId")} readOnly={readOnly} />}
      </fieldset>
      {!readOnly && (
        <div className="flex justify-end gap-2 border-t border-mist pt-6">
          <Button type="button" variant="ghost" onClick={() => router.back()}>{tc("cancel")}</Button>
          <Button type="submit" loading={pending}><Save />{pending ? tc("saving") : tc("save")}</Button>
        </div>
      )}
    </form>
  );
}

/** Responsable de l'agence : un gestionnaire, choisi dans une liste avec recherche. */
function ResponsibleSection({ managers, value, onChange, error, readOnly }: { managers: ManagerChoice[]; value: string; onChange: (id: string) => void; error?: string; readOnly: boolean }) {
  const t = useTranslations("Agencies");
  const tm = useTranslations("Managers");
  const e = useTranslations("Enums");
  const label = (m: ManagerChoice) => `${m.firstName} ${m.lastName}${m.email ? ` · ${m.email}` : ""}`;
  const byLabel = new Map(managers.map((m) => [label(m), m.id]));
  const chosen = managers.find((m) => m.id === value) ?? null;
  return (
    <Section title={t("manager")} hint={t("managerAccountHint")}>
      <Field label={t("chooseManager")} required error={error} className="sm:col-span-2">
        {(p) => (
          <SuggestCombobox
            {...p}
            disabled={readOnly}
            options={managers.filter((m) => m.active || m.id === value).map(label)}
            value={chosen ? label(chosen) : ""}
            onChange={(l) => onChange(byLabel.get(l) ?? "")}
            labels={{ search: t("searchManager"), choose: t("chooseManager"), noResult: t("noManagerFound") }}
          />
        )}
      </Field>
      {chosen && (
        <div className="flex items-center gap-4 rounded-xl border border-mist bg-chalk/60 p-4 sm:col-span-2">
          <ManagerAvatar photoUrl={chosen.photoUrl} firstName={chosen.firstName} lastName={chosen.lastName} size="md" />
          <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-ink-3">{tm("civility")}</dt><dd className="font-medium text-ink">{e(`civility.${chosen.civility}`)}</dd></div>
            <div><dt className="text-xs text-ink-3">{tm("lastName")} / {tm("firstName")}</dt><dd className="font-medium text-ink">{chosen.lastName} {chosen.firstName}</dd></div>
            <div><dt className="text-xs text-ink-3">{tm("email")}</dt><dd className="truncate font-medium text-ink" dir="ltr">{chosen.email ?? "—"}</dd></div>
            <div><dt className="text-xs text-ink-3">{tm("phone")}</dt><dd className="font-medium text-ink tabular" dir="ltr">{chosen.phone}</dd></div>
          </dl>
        </div>
      )}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-majorelle/40 bg-majorelle-soft/40 px-4 py-3 text-sm text-ink-2 sm:col-span-2">
          <span className="min-w-0 flex-1">{t("managerMissing")}</span>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/managers/new">
              <UserPlus />
              {t("addManager")}
            </Link>
          </Button>
        </div>
      )}
    </Section>
  );
}
