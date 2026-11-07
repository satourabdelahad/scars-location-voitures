"use client";

import { Camera, ClipboardCheck, Eraser, Eye, Fuel, Gauge, Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, EmptyState, Panel } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { ACCEPT_IMAGES, uploadFile } from "@/lib/upload-client";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { addInspection, inspectionMedia } from "@/server/actions/car-file";
import type { InspectionRow } from "@/server/queries/car-file";

type Res = { id: string; reference: string; status: string; startDate: string; endDate: string; name: string };

/** Jauge de carburant en huitièmes. */
export function FuelGauge({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1" role={onChange ? "radiogroup" : undefined}>
      <Fuel className="me-1 size-4 text-ink-3" />
      {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role={onChange ? "radio" : undefined}
          aria-checked={onChange ? value === n : undefined}
          aria-label={`${n}/8`}
          disabled={!onChange}
          onClick={() => onChange?.(value === n ? n - 1 : n)}
          className={cn("h-5 w-4 rounded-sm border transition-colors", n <= value ? "border-palm bg-palm" : "border-mist-2 bg-chalk", onChange && "hover:border-palm")}
        />
      ))}
      <span className="ms-2 text-xs font-semibold text-ink-2 tabular">{value}/8</span>
    </div>
  );
}

export function InspectionsTab({
  carId,
  rows,
  reservations,
  currentMileage,
  readOnly,
  preset,
}: {
  carId: string;
  rows: InspectionRow[];
  reservations: Res[];
  currentMileage: number;
  readOnly: boolean;
  /** Ouvre directement le formulaire (lien depuis une réservation) */
  preset?: { kind: "departure" | "return"; reservationId?: string } | null;
}) {
  const t = useTranslations("Inspection");
  const locale = useLocale();
  const [creating, setCreating] = useState<{ kind: "departure" | "return"; reservationId?: string } | null>(readOnly ? null : (preset ?? null));
  const [viewing, setViewing] = useState<InspectionRow | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-3">{t("intro")}</p>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCreating({ kind: "departure" })}><Plus />{t("newDeparture")}</Button>
            <Button onClick={() => setCreating({ kind: "return" })}><Plus />{t("newReturn")}</Button>
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <Panel><EmptyState icon={<ClipboardCheck />} title={t("none")} body={t("noneBody")} /></Panel>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Panel className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.kind === "departure" ? "info" : "success"}>{t(r.kind)}</Badge>
                  {r.reference && <Badge>{r.reference}</Badge>}
                  <span className="ms-auto text-xs text-ink-3">{formatDateTime(r.createdAt, locale)}{r.createdBy ? ` · ${r.createdBy}` : ""}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-ink tabular"><Gauge className="size-4 text-ink-3" />{r.mileage.toLocaleString(locale)} km</span>
                  <FuelGauge value={r.fuelEighths} />
                </div>
                {r.damages && <p className="mt-3 text-sm text-ink-2"><span className="font-semibold">{t("damages")} : </span>{r.damages}</p>}
                {r.notes && <p className="mt-1 text-sm text-ink-3">{r.notes}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={r.signed ? "success" : "warning"}>{r.signed ? t("signedBy", { name: r.signedByName ?? "—" }) : t("notSigned")}</Badge>
                  <Badge>{t("photos", { count: r.photos })}</Badge>
                  {(r.photos > 0 || r.signed) && (
                    <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setViewing(r)}><Eye />{t("view")}</Button>
                  )}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <InspectionDialog carId={carId} kind={creating.kind} reservationId={creating.reservationId} reservations={reservations} currentMileage={currentMileage} onClose={() => setCreating(null)} />
      )}
      {viewing && <MediaDialog row={viewing} onClose={() => setViewing(null)} />}
      <p className="text-xs text-ink-3">{t("dateNote", { date: formatDate(new Date(), locale) })}</p>
    </div>
  );
}

function MediaDialog({ row, onClose }: { row: InspectionRow; onClose: () => void }) {
  const t = useTranslations("Inspection");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const [data, setData] = useState<{ photos: { url: string; caption: string | null }[]; signature: string | null } | null>(null);
  useEffect(() => {
    inspectionMedia(row.id).then((r) => (r.ok ? setData(r.data!) : toast.error(te(r.error as "unknown"))));
  }, [row.id, te]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t(row.kind)} closeLabel={tc("close")} className="max-w-3xl">
        {!data ? (
          <p className="py-10 text-center text-sm text-ink-3">{tc("loading")}</p>
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            {data.photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.photos.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-mist">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption ?? ""} className="aspect-[4/3] w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
            {data.signature && (
              <div>
                <p className="mb-2 text-sm font-semibold text-ink-2">{t("signature")} · {row.signedByName}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.signature} alt={t("signature")} className="h-32 rounded-xl border border-mist bg-white p-2" />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Zone de signature au doigt ou à la souris (téléphone, tablette, ordinateur). */
function SignaturePad({ onChange }: { onChange: (empty: boolean) => void }) {
  const t = useTranslations("Inspection");
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, []);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  return (
    <div>
      <canvas
        ref={ref}
        data-signature
        className="h-40 w-full touch-none rounded-xl border border-dashed border-mist-2 bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          ref.current!.setPointerCapture(e.pointerId);
          const ctx = ref.current!.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(...pos(e));
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = ref.current!.getContext("2d")!;
          ctx.lineTo(...pos(e));
          ctx.stroke();
          onChange(false);
        }}
        onPointerUp={() => (drawing.current = false)}
      />
      <button
        type="button"
        onClick={() => {
          const c = ref.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          onChange(true);
        }}
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink"
      >
        <Eraser className="size-3.5" />
        {t("clear")}
      </button>
    </div>
  );
}

function InspectionDialog({
  carId,
  kind: initialKind,
  reservationId,
  reservations,
  currentMileage,
  onClose,
}: {
  carId: string;
  kind: "departure" | "return";
  reservationId?: string;
  reservations: Res[];
  currentMileage: number;
  onClose: () => void;
}) {
  const t = useTranslations("Inspection");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [kind, setKind] = useState(initialKind);
  const [resId, setResId] = useState(reservationId ?? reservations.find((r) => (initialKind === "departure" ? r.status === "confirmed" : r.status === "ongoing"))?.id ?? "");
  const [mileage, setMileage] = useState(String(currentMileage));
  const [fuel, setFuel] = useState(8);
  const [damages, setDamages] = useState("");
  const [notes, setNotes] = useState("");
  const [signer, setSigner] = useState(() => reservations.find((r) => r.id === (reservationId ?? ""))?.name ?? "");
  const [sigEmpty, setSigEmpty] = useState(true);
  const [photos, setPhotos] = useState<{ publicId: string; name: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(list)) {
        const up = await uploadFile(f, "document");
        setPhotos((s) => [...s, { publicId: up.publicId, name: f.name.slice(0, 200), preview: URL.createObjectURL(f) }]);
      }
    } catch (err) {
      toast.error(te(((err as Error).message as "unknown") || "unknown"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = () =>
    start(async () => {
      if (!mileage) return void setErrors({ mileage: "required" });
      let signature: { publicId: string; name: string; resourceType: "image" } | null = null;
      if (!sigEmpty) {
        const canvas = wrapRef.current?.querySelector<HTMLCanvasElement>("canvas[data-signature]");
        const blob = canvas ? await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png")) : null;
        if (blob) {
          try {
            const up = await uploadFile(new File([blob], "signature.png", { type: "image/png" }), "document");
            signature = { publicId: up.publicId, name: "signature.png", resourceType: "image" };
          } catch (err) {
            return void toast.error(te(((err as Error).message as "unknown") || "unknown"));
          }
        }
      }
      const r = await addInspection(
        carId,
        { kind, reservationId: resId || null, mileage, fuelEighths: fuel, damages, notes, signedByName: signer },
        photos.map((p) => ({ publicId: p.publicId, name: p.name, resourceType: "image" })),
        signature,
      );
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors);
        return void toast.error(te(r.error as "unknown"));
      }
      toast.success(t("saved"));
      onClose();
      router.refresh();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={kind === "departure" ? t("newDeparture") : t("newReturn")} description={t("dialogHint")} closeLabel={tc("close")} className="max-w-2xl">
        <div ref={wrapRef} className="grid max-h-[68vh] gap-4 overflow-y-auto pe-1 sm:grid-cols-2">
          <Field label={t("kind")} required>
            {(p) => (
              <Select {...p} value={kind} onChange={(x) => setKind(x.target.value as "departure" | "return")}>
                <option value="departure">{t("departure")}</option>
                <option value="return">{t("return")}</option>
              </Select>
            )}
          </Field>
          <Field label={t("reservation")}>
            {(p) => (
              <Select
                {...p}
                value={resId}
                onChange={(x) => {
                  setResId(x.target.value);
                  const r = reservations.find((y) => y.id === x.target.value);
                  if (r && !signer) setSigner(r.name);
                }}
              >
                <option value="">{t("noReservation")}</option>
                {reservations.map((r) => <option key={r.id} value={r.id}>{r.reference} · {r.name} · {r.startDate} → {r.endDate}</option>)}
              </Select>
            )}
          </Field>
          <Field label={t("mileage")} required error={errors.mileage ? te(errors.mileage as "required") : undefined}>
            {(p) => <Input {...p} type="number" min={0} inputMode="numeric" value={mileage} onChange={(x) => setMileage(x.target.value)} />}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">{t("fuel")} <span className="text-danger">*</span></span>
            <div className="flex h-10 items-center"><FuelGauge value={fuel} onChange={setFuel} /></div>
          </div>
          <Field label={t("damages")} hint={t("damagesHint")} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={3} value={damages} onChange={(x) => setDamages(x.target.value)} />}
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-semibold text-ink-2">{t("photosLabel")}</p>
            <input ref={fileRef} type="file" accept={ACCEPT_IMAGES} capture="environment" multiple hidden onChange={(x) => pick(x.target.files)} />
            <div className="flex flex-wrap gap-2">
              {photos.map((ph, i) => (
                <div key={ph.publicId} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph.preview} alt="" className="size-20 rounded-lg border border-mist object-cover" />
                  <button type="button" aria-label={tc("remove")} onClick={() => setPhotos((s) => s.filter((_, j) => j !== i))} className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-chalk">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="grid size-20 place-items-center rounded-lg border border-dashed border-mist-2 text-ink-3 hover:border-ink-3 hover:text-ink">
                <Camera className={cn("size-5", uploading && "animate-pulse")} />
              </button>
            </div>
          </div>
          <Field label={t("notes")} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} value={notes} onChange={(x) => setNotes(x.target.value)} />}
          </Field>
          <Field label={t("signer")}>
            {(p) => <Input {...p} value={signer} onChange={(x) => setSigner(x.target.value)} />}
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-semibold text-ink-2">{t("signature")}</p>
            <SignaturePad onChange={setSigEmpty} />
            <p className="mt-1 text-xs text-ink-3">{t("signatureHint")}</p>
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
