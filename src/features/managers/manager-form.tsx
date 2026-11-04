"use client";

import { FileCheck2, FileUp, Pencil, RefreshCw, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { usePathname, useRouter } from "@/i18n/navigation";
import { DocumentLink } from "./manager-actions";
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

/** Création, consultation (champs grisés) ou modification d'une fiche gestionnaire. */
export type ManagerFormMode = "create" | "view" | "edit";

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
  initialMode,
  canEdit = true,
  canOpenDocs = false,
  statusActions,
}: {
  managerId?: string;
  initial?: Partial<ManagerFormValues>;
  existingDocs?: DocumentKind[];
  readOnly?: { lastLogin: string; adminUpdatedAt: string };
  initialMode?: ManagerFormMode;
  /** Bouton "Modifier" (administrateur uniquement) */
  canEdit?: boolean;
  /** Ouverture des pièces d'identité (administrateur uniquement) */
  canOpenDocs?: boolean;
  /** Bouton Activer/Désactiver, affiché à côté de "Modifier" */
  statusActions?: ReactNode;
}) {
  const t = useTranslations("Managers");
  const td = useTranslations("Documents");
  const te = useTranslations("Errors");
  const tc = useTranslations("Common");
  const e = useTranslations("Enums");
  const router = useRouter();
  const pathname = usePathname();
  const start0 = { ...EMPTY, ...initial };
  const [mode, setMode] = useState<ManagerFormMode>(initialMode ?? (managerId ? "view" : "create"));
  const [v, setV] = useState<ManagerFormValues>(start0);
  const [sameWa, setSameWa] = useState(Boolean(initial?.phone && initial.phone === initial.whatsapp));
  const [docs, setDocs] = useState<Partial<Record<DocumentKind, UploadedDoc>>>({});
  const [uploading, setUploading] = useState<DocumentKind | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const inputs = useRef<Partial<Record<DocumentKind, HTMLInputElement | null>>>({});
  const locked = mode === "view";

  const set = <K extends keyof ManagerFormValues>(k: K, value: ManagerFormValues[K]) =>
    setV((s) => ({ ...s, [k]: value, ...(k === "phone" && sameWa ? { whatsapp: value as string } : {}) }));
  const err = (k: string) => (errors[k] ? te(errors[k] as "required") : undefined);

  function cancelEdit() {
    setV(start0);
    setDocs({});
    setErrors({});
    setSameWa(Boolean(initial?.phone && initial.phone === initial.whatsapp));
    setMode("view");
    router.replace(pathname, { scroll: false });
  }

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
    if (locked) return;
    setErrors({});
    const data = { ...v, maritalStatus: v.maritalStatus || null };
    const documents = Object.fromEntries(Object.entries(docs).map(([k, d]) => [k, { publicId: d!.publicId, resourceType: d!.resourceType }]));
    start(async () => {
      const res = managerId ? await updateManager(managerId, { data, documents }) : await createManager({ data, documents });
      if (res.ok) {
        toast.success(managerId ? t("updated") : t("created"));
        if (managerId) {
          // Enregistré : retour en mode consultation, avec les données relues depuis la base.
          setDocs({});
          setMode("view");
          router.replace(pathname, { scroll: false });
          router.refresh();
        } else {
          router.push(`/admin/managers/${(res.data as { id: string }).id}`);
        }
      } else {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          // Amène l'utilisateur sur le premier champ signalé (souvent les pièces, en bas du formulaire).
          setTimeout(() => document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
        }
        toast.error(te(res.error as "unknown"));
      }
    });
  }

  const toolbar =
    mode === "create" ? null : (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-mist pb-5">
        <p className="text-sm text-ink-3">{mode === "view" ? (canEdit ? t("viewHint") : t("viewHintReadOnly")) : t("editHint")}</p>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "view" ? (
            <>
              {statusActions}
              {canEdit && (
                <Button
                  key="edit"
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    // Sans cela, le bouton "Sauvegarder" qui prend sa place recevrait le même clic et validerait le formulaire.
                    e.preventDefault();
                    setTimeout(() => setMode("edit"), 0);
                  }}
                >
                  <Pencil />
                  {tc("edit")}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button key="cancel" type="button" variant="ghost" onClick={cancelEdit} disabled={pending}>{tc("cancel")}</Button>
              <Button key="save" type="submit" loading={pending} disabled={uploading !== null}>
                {!pending && <Save />}
                {pending ? tc("saving") : t("saveChanges")}
              </Button>
            </>
          )}
        </div>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className={cn("rounded-2xl border bg-paper p-6 transition-colors sm:p-8", mode === "edit" ? "border-majorelle/40 ring-4 ring-majorelle/10" : "border-mist")}>
      {toolbar}
      <Section title={t("identity")}>
        <Field label={t("civility")} required={!locked} error={err("civility")}>
          {(p) => (
            <div role="radiogroup" aria-labelledby={p.id} aria-disabled={locked || undefined} className="flex gap-2" {...(p["aria-invalid"] ? { "aria-invalid": true } : {})}>
              {(["male", "female"] as const).map((c) => (
                <label
                  key={c}
                  className={cn(
                    "flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] border text-sm font-semibold transition-colors",
                    locked ? "cursor-not-allowed" : "cursor-pointer",
                    v.civility === c
                      ? locked
                        ? "border-mist-2 bg-chalk text-ink"
                        : "border-majorelle bg-majorelle-soft text-majorelle"
                      : locked
                        ? "border-mist bg-chalk text-ink-3/60"
                        : "border-mist-2 text-ink-2 hover:border-ink-3",
                  )}
                >
                  <input type="radio" name="civility" value={c} checked={v.civility === c} disabled={locked} onChange={() => set("civility", c)} className="sr-only" id={c === "male" ? p.id : undefined} />
                  {e(`civility.${c}`)}
                </label>
              ))}
            </div>
          )}
        </Field>
        <div className="hidden sm:block" />
        <Field label={t("lastName")} required={!locked} error={err("lastName")}>{(p) => <Input {...p} disabled={locked} autoComplete="family-name" value={v.lastName} onChange={(x) => set("lastName", x.target.value)} />}</Field>
        <Field label={t("firstName")} required={!locked} error={err("firstName")}>{(p) => <Input {...p} disabled={locked} autoComplete="given-name" value={v.firstName} onChange={(x) => set("firstName", x.target.value)} />}</Field>
        <Field label={t("birthDate")} required={!locked} error={err("birthDate")}>{(p) => <Input {...p} disabled={locked} type="date" value={v.birthDate} onChange={(x) => set("birthDate", x.target.value)} />}</Field>
        <Field label={t("maritalStatus")} optionalLabel={locked ? undefined : tc("optional")}>
          {(p) => (
            <Select {...p} disabled={locked} value={v.maritalStatus} onChange={(x) => set("maritalStatus", x.target.value as ManagerFormValues["maritalStatus"])}>
              <option value="">—</option>
              {(["married", "widowed", "single"] as const).map((m) => <option key={m} value={m}>{e(`marital.${m}`)}</option>)}
            </Select>
          )}
        </Field>
      </Section>

      <Section title={t("contact")}>
        <Field label={t("email")} required={!locked} error={err("email")} className="sm:col-span-2">{(p) => <Input {...p} disabled={locked} type="email" dir="ltr" autoComplete="email" value={v.email} onChange={(x) => set("email", x.target.value)} />}</Field>
        <Field label={t("phone")} required={!locked} error={err("phone")}>{(p) => <Input {...p} disabled={locked} type="tel" dir="ltr" placeholder="+212 6 12 34 56 78" value={v.phone} onChange={(x) => set("phone", x.target.value)} />}</Field>
        <div className="flex flex-col gap-1.5">
          <Field label={t("whatsapp")} required={!locked} error={err("whatsapp")}>{(p) => <Input {...p} type="tel" dir="ltr" disabled={locked || sameWa} value={v.whatsapp} onChange={(x) => set("whatsapp", x.target.value)} />}</Field>
          {!locked && <Checkbox label={t("sameAsPhone")} checked={sameWa} onChange={(x) => { setSameWa(x.target.checked); if (x.target.checked) setV((s) => ({ ...s, whatsapp: s.phone })); }} />}
        </div>
        <Field label={t("city")} required={!locked} error={err("city")}>{(p) => <Input {...p} disabled={locked} autoComplete="address-level2" value={v.city} onChange={(x) => set("city", x.target.value)} />}</Field>
      </Section>

      <Section title={t("employment")}>
        <Field label={t("workStartDate")} required={!locked} error={err("workStartDate")}>{(p) => <Input {...p} disabled={locked} type="date" value={v.workStartDate} onChange={(x) => set("workStartDate", x.target.value)} />}</Field>
        <Field label={t("contractType")} required={!locked} error={err("contractType")}>
          {(p) => (
            <Select {...p} disabled={locked} value={v.contractType} onChange={(x) => set("contractType", x.target.value as ManagerFormValues["contractType"])}>
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
            <Field key={kind} label={td(kind)} required={required && !locked} optionalLabel={locked ? undefined : tc("optional")} error={err(kind)}>
              {(p) => (
                <div className={cn("flex items-center gap-3 rounded-[10px] border border-dashed px-3 py-2.5", errors[kind] ? "border-danger" : uploaded || exists ? "border-palm/50 bg-palm-soft/40" : "border-mist-2", locked && "border-solid")}>
                  {uploaded || exists ? <FileCheck2 className="size-5 shrink-0 text-palm" /> : <FileUp className="size-5 shrink-0 text-ink-3" />}
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{uploaded?.name ?? (exists ? td("stored") : td("missing"))}</span>
                  {locked ? (
                    exists && canOpenDocs && managerId ? <DocumentLink managerId={managerId} kind={kind} /> : null
                  ) : (
                    <>
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
                    </>
                  )}
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

      {mode === "create" && (
        <div className="flex justify-end gap-2 pt-6">
          <Button type="button" variant="ghost" onClick={() => router.back()}>{tc("cancel")}</Button>
          <Button type="submit" loading={pending} disabled={uploading !== null}>{pending ? tc("saving") : tc("save")}</Button>
        </div>
      )}
      {mode === "edit" && (
        <div className="flex justify-end gap-2 border-t border-mist pt-6">
          <Button type="button" variant="ghost" onClick={cancelEdit} disabled={pending}>{tc("cancel")}</Button>
          <Button type="submit" loading={pending} disabled={uploading !== null}>
            {!pending && <Save />}
            {pending ? tc("saving") : t("saveChanges")}
          </Button>
        </div>
      )}
    </form>
  );
}
