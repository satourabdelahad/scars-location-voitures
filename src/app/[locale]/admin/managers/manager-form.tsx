"use client";

import { FileCheck2, FileUp, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import type { DocumentKind } from "@/db/schema";
import { ACCEPT_DOCS, uploadFile } from "@/lib/upload-client";
import { createManager, updateManager } from "@/server/actions/managers";
import { cn } from "@/lib/utils";

export type ManagerFormValues = {
  civility: "" | "male" | "female";
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  whatsapp: string;
  city: string;
  birthDate: string;
  maritalStatus: "" | "married" | "widowed" | "single";
  workStartDate: string;
  contractType: "" | "freelance" | "cdi";
};

const EMPTY: ManagerFormValues = {
  civility: "",
  lastName: "",
  firstName: "",
  email: "",
  phone: "",
  whatsapp: "",
  city: "",
  birthDate: "",
  maritalStatus: "",
  workStartDate: "",
  contractType: "",
};

const DOCS: { kind: DocumentKind; required: boolean }[] = [
  { kind: "cin_front", required: true },
  { kind: "cin_back", required: true },
  { kind: "license_front", required: false },
  { kind: "license_back", required: false },
];

type UploadedDoc = { publicId: string; resourceType: "image" | "raw"; name: string };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-mist py-8 first:pt-0 last:border-0 lg:grid-cols-[220px_1fr]">
      <h2 className="text-[15px] font-bold text-ink">{title}</h2>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function ManagerForm({
  managerId,
  initial,
  existingDocs = [],
  readOnly,
}: {
  managerId?: string;
  initial?: Partial<ManagerFormValues>;
  existingDocs?: DocumentKind[];
  readOnly?: { lastLogin: string; adminUpdatedAt: string };
}) {
  const t = useTranslations("Managers");
  const td = useTranslations("Documents");
  const te = useTranslations("Errors");
  const tc = useTranslations("Common");
  const e = useTranslations("Enums");
  const router = useRouter();
  const [v, setV] = useState<ManagerFormValues>({ ...EMPTY, ...initial });
  const [sameWa, setSameWa] = useState(Boolean(initial?.phone && initial.phone === initial.whatsapp));
  const [docs, setDocs] = useState<Partial<Record<DocumentKind, UploadedDoc>>>({});
  const [uploading, setUploading] = useState<DocumentKind | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const inputs = useRef<Partial<Record<DocumentKind, HTMLInputElement | null>>>({});

  const set = <K extends keyof ManagerFormValues>(k: K, value: ManagerFormValues[K]) =>
    setV((s) => ({ ...s, [k]: value, ...(k === "phone" && sameWa ? { whatsapp: value as string } : {}) }));
  const err = (k: string) => (errors[k] ? te(errors[k] as "required") : undefined);

  async function onFile(kind: DocumentKind, file: File | undefined) {
    if (!file) return;
    setUploading(kind);
    try {
      const up = await uploadFile(file, "identity");
      setDocs((d) => ({ ...d, [kind]: { publicId: up.publicId, resourceType: up.resourceType as "image" | "raw", name: file.name } }));
      setErrors(({ [kind]: _, ...rest }) => rest);
    } catch (x) {
      const code = (x as Error).message;
      toast.error(code === "too_big" ? td("tooBig") : code === "bad_type" ? td("badType") : code === "cloudinary_not_configured" ? td("notConfigured") : te("unknown"));
    } finally {
      setUploading(null);
      const el = inputs.current[kind];
      if (el) el.value = "";
    }
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setErrors({});
    const data = { ...v, maritalStatus: v.maritalStatus || null };
    const documents = Object.fromEntries(Object.entries(docs).map(([k, d]) => [k, { publicId: d!.publicId, resourceType: d!.resourceType }]));
    start(async () => {
      const res = managerId ? await updateManager(managerId, { data, documents }) : await createManager({ data, documents });
      if (res.ok) {
        toast.success(managerId ? t("updated") : t("created"));
        const id = managerId ?? (res.data as { id: string }).id;
        router.push(`/admin/managers/${id}`);
        router.refresh();
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(te(res.error as "unknown"));
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-mist bg-paper p-6 sm:p-8">
      <Section title={t("identity")}>
        <Field label={t("civility")} required error={err("civility")}>
          {(p) => (
            <div role="radiogroup" aria-labelledby={p.id} className="flex gap-2" {...(p["aria-invalid"] ? { "aria-invalid": true } : {})}>
              {(["male", "female"] as const).map((c) => (
                <label key={c} className={cn("flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] border text-sm font-semibold transition-colors", v.civility === c ? "border-majorelle bg-majorelle-soft text-majorelle" : "border-mist-2 text-ink-2 hover:border-ink-3")}>
                  <input type="radio" name="civility" value={c} checked={v.civility === c} onChange={() => set("civility", c)} className="sr-only" id={c === "male" ? p.id : undefined} />
                  {e(`civility.${c}`)}
                </label>
              ))}
            </div>
          )}
        </Field>
        <div className="hidden sm:block" />
        <Field label={t("lastName")} required error={err("lastName")}>{(p) => <Input {...p} autoComplete="family-name" value={v.lastName} onChange={(x) => set("lastName", x.target.value)} />}</Field>
        <Field label={t("firstName")} required error={err("firstName")}>{(p) => <Input {...p} autoComplete="given-name" value={v.firstName} onChange={(x) => set("firstName", x.target.value)} />}</Field>
        <Field label={t("birthDate")} required error={err("birthDate")}>{(p) => <Input {...p} type="date" value={v.birthDate} onChange={(x) => set("birthDate", x.target.value)} />}</Field>
        <Field label={t("maritalStatus")} optionalLabel={tc("optional")}>
          {(p) => (
            <Select {...p} value={v.maritalStatus} onChange={(x) => set("maritalStatus", x.target.value as ManagerFormValues["maritalStatus"])}>
              <option value="">—</option>
              {(["married", "widowed", "single"] as const).map((m) => <option key={m} value={m}>{e(`marital.${m}`)}</option>)}
            </Select>
          )}
        </Field>
      </Section>

      <Section title={t("contact")}>
        <Field label={t("email")} required error={err("email")} className="sm:col-span-2">{(p) => <Input {...p} type="email" dir="ltr" autoComplete="email" value={v.email} onChange={(x) => set("email", x.target.value)} />}</Field>
        <Field label={t("phone")} required error={err("phone")}>{(p) => <Input {...p} type="tel" dir="ltr" placeholder="+212 6 12 34 56 78" value={v.phone} onChange={(x) => set("phone", x.target.value)} />}</Field>
        <div className="flex flex-col gap-1.5">
          <Field label={t("whatsapp")} required error={err("whatsapp")}>{(p) => <Input {...p} type="tel" dir="ltr" disabled={sameWa} value={v.whatsapp} onChange={(x) => set("whatsapp", x.target.value)} />}</Field>
          <Checkbox label={t("sameAsPhone")} checked={sameWa} onChange={(x) => { setSameWa(x.target.checked); if (x.target.checked) setV((s) => ({ ...s, whatsapp: s.phone })); }} />
        </div>
        <Field label={t("city")} required error={err("city")}>{(p) => <Input {...p} autoComplete="address-level2" value={v.city} onChange={(x) => set("city", x.target.value)} />}</Field>
      </Section>

      <Section title={t("employment")}>
        <Field label={t("workStartDate")} required error={err("workStartDate")}>{(p) => <Input {...p} type="date" value={v.workStartDate} onChange={(x) => set("workStartDate", x.target.value)} />}</Field>
        <Field label={t("contractType")} required error={err("contractType")}>
          {(p) => (
            <Select {...p} value={v.contractType} onChange={(x) => set("contractType", x.target.value as ManagerFormValues["contractType"])}>
              <option value="">—</option>
              {(["cdi", "freelance"] as const).map((c) => <option key={c} value={c}>{e(`contract.${c}`)}</option>)}
            </Select>
          )}
        </Field>
      </Section>

      <Section title={t("documents")}>
        <p className="text-sm text-ink-3 sm:col-span-2">{td("privateNote")}</p>
        {DOCS.map(({ kind, required }) => {
          const uploaded = docs[kind];
          const exists = existingDocs.includes(kind);
          const busy = uploading === kind;
          return (
            <Field key={kind} label={td(kind)} required={required} optionalLabel={tc("optional")} error={err(kind)}>
              {(p) => (
                <div className={cn("flex items-center gap-3 rounded-[10px] border border-dashed px-3 py-2.5", errors[kind] ? "border-danger" : uploaded || exists ? "border-palm/50 bg-palm-soft/40" : "border-mist-2")}>
                  {uploaded || exists ? <FileCheck2 className="size-5 shrink-0 text-palm" /> : <FileUp className="size-5 shrink-0 text-ink-3" />}
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{uploaded?.name ?? (exists ? td("stored") : td("missing"))}</span>
                  <input
                    ref={(el) => { inputs.current[kind] = el; }}
                    id={p.id}
                    type="file"
                    accept={ACCEPT_DOCS}
                    className="sr-only"
                    aria-describedby={p["aria-describedby"]}
                    onChange={(x) => onFile(kind, x.target.files?.[0])}
                  />
                  <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => inputs.current[kind]?.click()}>
                    {!busy && (uploaded || exists ? <RefreshCw /> : <FileUp />)}
                    {busy ? td("uploading") : uploaded || exists ? td("replace") : td("upload")}
                  </Button>
                </div>
              )}
            </Field>
          );
        })}
      </Section>

      {readOnly && (
        <Section title={t("tracking")}>
          <Field label={`${t("lastLogin")} (${tc("readOnly")})`}>{(p) => <Input {...p} readOnly disabled value={readOnly.lastLogin} />}</Field>
          <Field label={`${t("adminUpdatedAt")} (${tc("readOnly")})`}>{(p) => <Input {...p} readOnly disabled value={readOnly.adminUpdatedAt} />}</Field>
        </Section>
      )}

      <div className="flex justify-end gap-2 pt-6">
        <Button type="button" variant="ghost" onClick={() => router.back()}>{tc("cancel")}</Button>
        <Button type="submit" loading={pending} disabled={uploading !== null}>{pending ? tc("saving") : tc("save")}</Button>
      </div>
    </form>
  );
}
