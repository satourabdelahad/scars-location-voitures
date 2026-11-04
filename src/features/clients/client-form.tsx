"use client";

import { Pencil, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeMeta, locales } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { createClient, updateClient } from "@/server/actions/clients";

export type ClientFormValues = {
  civility: "" | "male" | "female";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string;
  city: string;
  birthDate: string;
  licenseNumber: string;
  preferredLocale: string;
  notes: string;
};
const EMPTY: ClientFormValues = { civility: "", firstName: "", lastName: "", email: "", phone: "", whatsapp: "", city: "", birthDate: "", licenseNumber: "", preferredLocale: "fr", notes: "" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-6 border-b border-mist py-8 first:pt-0 last:border-0 lg:grid-cols-[220px_minmax(0,1fr)]">
      <h2 className="text-[15px] font-bold text-ink">{title}</h2>
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Fiche client : création, consultation (champs grisés) puis « Modifier » / « Sauvegarder ». */
export function ClientForm({ base, clientId, initial, statusActions }: { base: string; clientId?: string; initial?: Partial<ClientFormValues>; statusActions?: ReactNode }) {
  const t = useTranslations("Clients");
  const tm = useTranslations("Managers");
  const te = useTranslations("Errors");
  const tc = useTranslations("Common");
  const e = useTranslations("Enums");
  const router = useRouter();
  const pathname = usePathname();
  const start0 = { ...EMPTY, ...initial };
  const [mode, setMode] = useState<"create" | "view" | "edit">(clientId ? "view" : "create");
  const [v, setV] = useState(start0);
  const [version, setVersion] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const locked = mode === "view";
  const set = <K extends keyof ClientFormValues>(k: K, value: ClientFormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const err = (k: string) => (errors[k] ? te(errors[k] as "required") : undefined);

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (locked) return;
    setErrors({});
    start(async () => {
      const res = clientId ? await updateClient(clientId, v) : await createClient(v);
      if (res.ok) {
        toast.success(clientId ? t("updated") : t("created"));
        if (clientId) {
          setMode("view");
          router.replace(pathname, { scroll: false });
          router.refresh();
        } else router.push(`${base}/clients/${(res.data as { id: string }).id}`);
      } else {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          setTimeout(() => document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
        }
        toast.error(te(res.error as "unknown"));
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className={cn("rounded-2xl border bg-paper p-6 transition-colors sm:p-8", mode === "edit" ? "border-majorelle/40 ring-4 ring-majorelle/10" : "border-mist")}>
      {mode !== "create" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-mist pb-5">
          <p className="text-sm text-ink-3">{mode === "view" ? t("viewHint") : tm("editHint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {mode === "view" ? (
              <>
                {statusActions}
                <Button key="edit" type="button" variant="outline" onClick={(x) => { x.preventDefault(); setTimeout(() => setMode("edit"), 0); }}>
                  <Pencil />
                  {tc("edit")}
                </Button>
              </>
            ) : (
              <>
                <Button key="cancel" type="button" variant="ghost" disabled={pending} onClick={() => { setV(start0); setVersion((n) => n + 1); setErrors({}); setMode("view"); }}>{tc("cancel")}</Button>
                <Button key="save" type="submit" loading={pending}><Save />{tm("saveChanges")}</Button>
              </>
            )}
          </div>
        </div>
      )}

      <Section title={t("identity")}>
        <Field label={t("civility")} error={err("civility")}>
          {(p) => (
            <Select {...p} disabled={locked} value={v.civility} onChange={(x) => set("civility", x.target.value as ClientFormValues["civility"])}>
              <option value="">—</option>
              <option value="male">{e("civility.male")}</option>
              <option value="female">{e("civility.female")}</option>
            </Select>
          )}
        </Field>
        <span className="hidden sm:block" />
        <Field label={t("lastName")} required={!locked} error={err("lastName")}>{(p) => <Input {...p} disabled={locked} value={v.lastName} onChange={(x) => set("lastName", x.target.value)} />}</Field>
        <Field label={t("firstName")} required={!locked} error={err("firstName")}>{(p) => <Input {...p} disabled={locked} value={v.firstName} onChange={(x) => set("firstName", x.target.value)} />}</Field>
        <Field label={t("birthDate")} optionalLabel={locked ? undefined : tc("optional")} error={err("birthDate")}>{(p) => <Input {...p} disabled={locked} type="date" value={v.birthDate} onChange={(x) => set("birthDate", x.target.value)} />}</Field>
        <Field label={t("licenseNumber")} optionalLabel={locked ? undefined : tc("optional")} error={err("licenseNumber")}>{(p) => <Input {...p} disabled={locked} dir="ltr" value={v.licenseNumber} onChange={(x) => set("licenseNumber", x.target.value)} />}</Field>
      </Section>

      <Section title={t("contact")}>
        <Field label={t("phone")} required={!locked} error={err("phone")}>{(p) => <PhoneInput key={`p-${version}`} {...p} disabled={locked} value={v.phone} onChange={(x) => set("phone", x)} />}</Field>
        <Field label={t("whatsapp")} optionalLabel={locked ? undefined : tc("optional")} error={err("whatsapp")}>{(p) => <PhoneInput key={`w-${version}`} {...p} disabled={locked} value={v.whatsapp} onChange={(x) => set("whatsapp", x)} />}</Field>
        <Field label={t("email")} optionalLabel={locked ? undefined : tc("optional")} error={err("email")}>{(p) => <Input {...p} disabled={locked} type="email" dir="ltr" value={v.email} onChange={(x) => set("email", x.target.value)} />}</Field>
        <Field label={t("city")} optionalLabel={locked ? undefined : tc("optional")} error={err("city")}>{(p) => <Input {...p} disabled={locked} value={v.city} onChange={(x) => set("city", x.target.value)} />}</Field>
        <Field label={t("language")} hint={locked ? undefined : t("languageHint")}>
          {(p) => (
            <Select {...p} disabled={locked} value={v.preferredLocale} onChange={(x) => set("preferredLocale", x.target.value)}>
              {locales.map((l) => <option key={l} value={l}>{localeMeta[l].native}</option>)}
            </Select>
          )}
        </Field>
      </Section>

      <Section title={t("notes")}>
        <Field label={t("notes")} optionalLabel={locked ? undefined : tc("optional")} className="sm:col-span-2">
          {(p) => <Textarea {...p} disabled={locked} rows={3} value={v.notes} onChange={(x) => set("notes", x.target.value)} />}
        </Field>
      </Section>

      {mode === "create" && (
        <div className="flex justify-end gap-2 border-t border-mist pt-6">
          <Button type="button" variant="ghost" onClick={() => router.back()}>{tc("cancel")}</Button>
          <Button type="submit" loading={pending}><Save />{tc("save")}</Button>
        </div>
      )}
    </form>
  );
}
