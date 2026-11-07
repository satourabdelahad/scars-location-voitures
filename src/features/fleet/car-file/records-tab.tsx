"use client";

import { Ban, CalendarClock, FileText, Paperclip, Pencil, Plus, Upload, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, EmptyState, Panel, type Tone } from "@/components/ui/misc";
import { expenseCategoryEnum, type CarRecordKind, type ExpenseCategory } from "@/db/schema";
import { useRouter } from "@/i18n/navigation";
import { ACCEPT_DOCS, uploadFile } from "@/lib/upload-client";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { addCarRecord, carRecordFileUrl, updateCarRecord, voidCarRecord } from "@/server/actions/car-file";
import type { CarRecordRow } from "@/server/queries/car-file";

type FieldKey = "performedOn" | "validUntil" | "mileage" | "nextMileage" | "amount" | "provider" | "reference" | "category" | "notes";

/** Champs proposés pour chaque type de ligne (les libellés viennent de CarFile.<kind>.<champ>). */
const FIELDS: Record<CarRecordKind, FieldKey[]> = {
  insurance: ["provider", "reference", "performedOn", "validUntil", "amount", "notes"],
  vignette: ["performedOn", "validUntil", "amount", "reference", "notes"],
  oil_change: ["performedOn", "mileage", "validUntil", "nextMileage", "provider", "amount", "notes"],
  technical_inspection: ["performedOn", "validUntil", "provider", "reference", "amount", "notes"],
  expense: ["performedOn", "category", "amount", "provider", "mileage", "notes"],
};
const REQUIRED: Record<CarRecordKind, FieldKey[]> = {
  insurance: ["performedOn", "validUntil"],
  vignette: ["performedOn", "validUntil"],
  oil_change: ["performedOn"],
  technical_inspection: ["performedOn", "validUntil"],
  expense: ["performedOn", "category", "amount"],
};

type Values = Record<FieldKey, string>;
const EMPTY: Values = { performedOn: "", validUntil: "", mileage: "", nextMileage: "", amount: "", provider: "", reference: "", category: "", notes: "" };
const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (d: string) => Math.round((new Date(`${d}T12:00:00`).getTime() - Date.now()) / 86_400_000);

/** État de l'échéance la plus récente : à jour, bientôt, expirée. */
export function deadlineState(validUntil: string | null, warnDays: number): { tone: Tone; days: number | null } {
  if (!validUntil) return { tone: "neutral", days: null };
  const days = daysUntil(validUntil);
  return { tone: days < 0 ? "danger" : days <= warnDays ? "warning" : "success", days };
}

export function CarRecordsTab({
  carId,
  kind,
  records,
  currentMileage,
  warnDays,
  warnKm = 0,
  readOnly,
}: {
  carId: string;
  kind: CarRecordKind;
  records: CarRecordRow[];
  currentMileage: number;
  warnDays: number;
  warnKm?: number;
  readOnly: boolean;
}) {
  const t = useTranslations("CarFile");
  const e = useTranslations("Enums");
  const locale = useLocale();
  const [editing, setEditing] = useState<CarRecordRow | "new" | null>(null);
  const live = records.filter((r) => !r.voided);
  const last = live[0];
  const state = deadlineState(last?.validUntil ?? null, warnDays);
  const kmLeft = last?.nextMileage != null ? last.nextMileage - currentMileage : null;
  const total = live.reduce((s, r) => s + (r.amount ?? 0), 0);
  const fields = FIELDS[kind];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {kind !== "expense" ? (
          <Panel className="p-5 sm:col-span-2">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">
              <CalendarClock className="size-4" />
              {t(`${kind}.status`)}
            </p>
            {last ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-2xl font-extrabold text-ink tabular">{last.validUntil ? formatDate(last.validUntil, locale) : "—"}</span>
                {state.days != null && (
                  <Badge tone={state.tone}>
                    {state.days < 0 ? t("expiredSince", { count: -state.days }) : state.days === 0 ? t("expiresToday") : t("expiresIn", { count: state.days })}
                  </Badge>
                )}
                {kind === "oil_change" && last.nextMileage != null && (
                  <Badge tone={kmLeft! < 0 ? "danger" : kmLeft! <= warnKm ? "warning" : "success"}>
                    {t("nextAtKm", { km: last.nextMileage.toLocaleString(locale) })} · {kmLeft! < 0 ? t("kmOver", { km: (-kmLeft!).toLocaleString(locale) }) : t("kmLeft", { km: kmLeft!.toLocaleString(locale) })}
                  </Badge>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-3">{t("noneYet")}</p>
            )}
            {last?.provider && <p className="mt-2 text-sm text-ink-2">{last.provider}{last.reference ? ` · ${last.reference}` : ""}</p>}
          </Panel>
        ) : (
          <Panel className="p-5 sm:col-span-2">
            <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{t("expense.status")}</p>
            <p className="mt-2 text-2xl font-extrabold text-ink tabular">{formatMoney(total, locale)}</p>
            <p className="mt-1 text-sm text-ink-3">{t("entries", { count: live.length })}</p>
          </Panel>
        )}
        <Panel className="flex flex-col justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{t("totalCost")}</p>
            <p className="mt-2 text-xl font-extrabold text-ink tabular">{formatMoney(total, locale)}</p>
          </div>
          {!readOnly && (
            <Button onClick={() => setEditing("new")}>
              <Plus />
              {t(`${kind}.add`)}
            </Button>
          )}
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <h3 className="border-b border-mist px-5 py-3 text-sm font-bold text-ink">{t("history")}</h3>
        {records.length === 0 ? (
          <EmptyState icon={<FileText />} title={t("noneYet")} body={t(`${kind}.empty`)} />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-chalk text-start text-xs font-semibold text-ink-3">
                <tr>
                  {fields.filter((f) => f !== "notes").map((f) => (
                    <th key={f} className="px-4 py-2.5 text-start font-semibold">{t(`${kind}.${f}`)}</th>
                  ))}
                  <th className="px-4 py-2.5 text-start font-semibold">{t("documents")}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {records.map((r) => (
                  <tr key={r.id} className={cn(r.voided && "text-ink-3 line-through")}>
                    {fields.filter((f) => f !== "notes").map((f) => (
                      <td key={f} className="px-4 py-3 align-top tabular">
                        {cellValue(r, f, locale, (c) => e(`expenseCategory.${c}`))}
                        {f === fields[0] && r.notes && <p className="mt-1 max-w-xs text-xs text-ink-3 no-underline">{r.notes}</p>}
                      </td>
                    ))}
                    <td className="px-4 py-3 align-top">
                      <FileLinks files={r.files} />
                    </td>
                    <td className="px-4 py-3 text-end align-top whitespace-nowrap">
                      {r.voided ? (
                        <Badge>{t("voided")}</Badge>
                      ) : (
                        !readOnly && (
                          <span className="inline-flex gap-1">
                            <Button size="icon" variant="ghost" aria-label={t("edit")} title={t("edit")} onClick={() => setEditing(r)}>
                              <Pencil className="size-4" />
                            </Button>
                            <VoidButton id={r.id} />
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && <RecordDialog carId={carId} kind={kind} record={editing === "new" ? null : editing} currentMileage={currentMileage} onClose={() => setEditing(null)} />}
    </div>
  );
}

function cellValue(r: CarRecordRow, f: FieldKey, locale: string, cat: (c: ExpenseCategory) => string) {
  switch (f) {
    case "performedOn":
    case "validUntil": {
      const v = r[f];
      return v ? formatDate(v, locale) : "—";
    }
    case "mileage":
    case "nextMileage": {
      const v = r[f];
      return v != null ? `${v.toLocaleString(locale)} km` : "—";
    }
    case "amount":
      return r.amount != null ? formatMoney(r.amount, locale) : "—";
    case "category":
      return r.category ? cat(r.category) : "—";
    default:
      return (r[f as "provider" | "reference"] as string | null) ?? "—";
  }
}

/** Documents privés : ouverts par un lien temporaire. */
export function FileLinks({ files }: { files: { id: number; name: string }[] }) {
  const te = useTranslations("Errors");
  const [busy, setBusy] = useState<number | null>(null);
  if (!files.length) return <span className="text-ink-3">—</span>;
  const open = async (id: number) => {
    setBusy(id);
    const r = await carRecordFileUrl(id);
    setBusy(null);
    if (!r.ok) return void toast.error(te(r.error as "unknown"));
    window.open(r.data!.url, "_blank", "noopener");
  };
  return (
    <ul className="space-y-1">
      {files.map((f) => (
        <li key={f.id}>
          <button type="button" onClick={() => open(f.id)} disabled={busy === f.id} className="inline-flex max-w-[180px] items-center gap-1.5 truncate text-[13px] font-medium text-majorelle no-underline hover:underline">
            <Paperclip className="size-3.5 shrink-0" />
            <span className="truncate">{f.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function VoidButton({ id }: { id: string }) {
  const t = useTranslations("CarFile");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button size="icon" variant="ghost" aria-label={t("void")} title={t("void")} onClick={() => setOpen(true)}>
        <Ban className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("voidTitle")} description={t("voidBody")} closeLabel={tc("close")}>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await voidCarRecord(id);
                  if (!r.ok) return void toast.error(te(r.error as "unknown"));
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {t("void")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Pending = { publicId: string; name: string; resourceType: "image" | "raw" };

function RecordDialog({ carId, kind, record, currentMileage, onClose }: { carId: string; kind: CarRecordKind; record: CarRecordRow | null; currentMileage: number; onClose: () => void }) {
  const t = useTranslations("CarFile");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const e = useTranslations("Enums");
  const router = useRouter();
  const [v, setV] = useState<Values>(() =>
    record
      ? {
          performedOn: record.performedOn,
          validUntil: record.validUntil ?? "",
          mileage: record.mileage?.toString() ?? "",
          nextMileage: record.nextMileage?.toString() ?? "",
          amount: record.amount?.toString() ?? "",
          provider: record.provider ?? "",
          reference: record.reference ?? "",
          category: record.category ?? "",
          notes: record.notes ?? "",
        }
      : { ...EMPTY, performedOn: today(), mileage: kind === "oil_change" ? String(currentMileage) : "" },
  );
  const [files, setFiles] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  const set = (k: FieldKey, val: string) => setV((s) => ({ ...s, [k]: val }));
  const required = REQUIRED[kind];

  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(list)) {
        const up = await uploadFile(f, "document");
        setFiles((s) => [...s, { publicId: up.publicId, name: f.name.slice(0, 200), resourceType: up.resourceType === "raw" ? "raw" : "image" }]);
      }
    } catch (err) {
      toast.error(te(((err as Error).message as "unknown") || "unknown"));
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const submit = () =>
    start(async () => {
      const missing = required.filter((k) => !v[k]);
      if (missing.length) return void setErrors(Object.fromEntries(missing.map((k) => [k, "required"])));
      const payload = { ...v, kind, category: kind === "expense" ? v.category || null : null };
      const r = record ? await updateCarRecord(record.id, payload, files) : await addCarRecord(carId, payload, files);
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors);
        return void toast.error(te(r.error as "unknown"));
      }
      toast.success(t("saved"));
      onClose();
      router.refresh();
    });

  const label = (f: FieldKey) => t(`${kind}.${f}`);
  const err = (f: FieldKey) => (errors[f] ? te(errors[f] as "required") : undefined);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={record ? t("editTitle") : t(`${kind}.add`)} closeLabel={tc("close")} className="max-w-2xl">
        <div className="grid max-h-[65vh] gap-4 overflow-y-auto pe-1 sm:grid-cols-2">
          {FIELDS[kind].map((f) => (
            <Field key={f} label={label(f)} required={required.includes(f)} error={err(f)} className={f === "notes" ? "sm:col-span-2" : undefined}>
              {(p) =>
                f === "notes" ? (
                  <Textarea {...p} rows={3} value={v.notes} onChange={(x) => set("notes", x.target.value)} />
                ) : f === "category" ? (
                  <Select {...p} value={v.category} onChange={(x) => set("category", x.target.value)}>
                    <option value="">—</option>
                    {expenseCategoryEnum.enumValues.map((c) => <option key={c} value={c}>{e(`expenseCategory.${c}`)}</option>)}
                  </Select>
                ) : (
                  <Input
                    {...p}
                    type={f === "performedOn" || f === "validUntil" ? "date" : f === "mileage" || f === "nextMileage" || f === "amount" ? "number" : "text"}
                    inputMode={f === "amount" ? "decimal" : undefined}
                    min={f === "validUntil" ? v.performedOn || undefined : f === "mileage" || f === "nextMileage" || f === "amount" ? 0 : undefined}
                    step={f === "amount" ? "0.01" : undefined}
                    value={v[f]}
                    onChange={(x) => set(f, x.target.value)}
                  />
                )
              }
            </Field>
          ))}
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-semibold text-ink-2">{t("documents")}</p>
            <p className="mb-2 text-xs text-ink-3">{t(`${kind}.docsHint`)}</p>
            <input ref={ref} type="file" accept={ACCEPT_DOCS} multiple hidden onChange={(x) => pick(x.target.files)} />
            <div className="flex flex-wrap items-center gap-2">
              {record?.files.map((f) => <Badge key={f.id}><Paperclip className="size-3" />{f.name}</Badge>)}
              {files.map((f, i) => (
                <Badge key={f.publicId} tone="info">
                  <Paperclip className="size-3" />
                  {f.name}
                  <button type="button" aria-label={tc("remove")} onClick={() => setFiles((s) => s.filter((_, j) => j !== i))}><X className="size-3" /></button>
                </Badge>
              ))}
              <Button type="button" size="sm" variant="outline" loading={uploading} onClick={() => ref.current?.click()}>
                <Upload />
                {t("addDocument")}
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
          <Button loading={pending} disabled={uploading} onClick={submit}>{tc("save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
