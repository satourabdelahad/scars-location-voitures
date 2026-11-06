"use client";

import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { CityCombobox } from "@/components/ui/city-combobox";
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
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  xUrl: string;
};
const URL_PLACEHOLDER = {
  websiteUrl: "https://dizy-cars.com",
  facebookUrl: "https://facebook.com/…",
  instagramUrl: "https://instagram.com/…",
  linkedinUrl: "https://linkedin.com/company/…",
  xUrl: "https://x.com/…",
} as const;

const EMPTY: AgencyValues = { name: "", city: "", address: "", phone: "", whatsapp: "", isAirport: false, websiteUrl: "", facebookUrl: "", instagramUrl: "", linkedinUrl: "", xUrl: "" };

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

/** Ajout / modification d'une agence (onglet Informations). Les responsables s'affectent ensuite dans leur onglet. */
export function AgencyForm({
  base,
  agencyId,
  initial,
  actions,
  readOnly = false,
}: {
  base: string;
  agencyId?: number;
  initial?: Partial<AgencyValues>;
  actions?: ReactNode;
  readOnly?: boolean;
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
        // Nouvelle agence : on enchaîne sur l'affectation des responsables.
        else router.push(`${base}/agencies/${(res.data as { id: number }).id}?tab=manager`);
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(te(res.error as "unknown"));
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-mist bg-paper p-6 sm:p-8">
      {actions && <div className="mb-6 flex flex-wrap justify-end gap-2 border-b border-mist pb-5">{actions}</div>}
      <fieldset disabled={readOnly} className="contents">
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
        <Section title={t("onlineTitle")}>
          {(["websiteUrl", "facebookUrl", "instagramUrl", "linkedinUrl", "xUrl"] as const).map((k) => (
            <Field key={k} label={t(k)} optionalLabel={tc("optional")} error={err(k)}>
              {(p) => <Input {...p} type="url" dir="ltr" inputMode="url" placeholder={URL_PLACEHOLDER[k]} value={v[k]} onChange={(x) => set(k, x.target.value)} />}
            </Field>
          ))}
        </Section>
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

