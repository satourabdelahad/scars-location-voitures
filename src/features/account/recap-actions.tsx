"use client";

import { CalendarPlus, Check, Download, Eye, FileUp, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { ACCEPT_DOCS, uploadFile } from "@/lib/upload-client";
import { formatDateTime } from "@/lib/utils";
import { requestExtension } from "@/server/actions/reservations";
import { clientDocumentUrl, uploadClientDocument } from "@/server/actions/client-space";
import { CancelReservationButton } from "@/app/[locale]/(site)/account/cancel-button";

/** Imprimer, télécharger en PDF, annuler, demander une prolongation. */
export function RecapActions({ id, reference, canCancel, canExtend, endDate }: { id: string; reference: string; canCancel: boolean; canExtend: boolean; endDate: string }) {
  const t = useTranslations("Account");
  const [pdf, setPdf] = useState(false);
  const [extending, setExtending] = useState(false);

  /** PDF du récapitulatif tel qu'il s'affiche (sans les boutons). */
  const download = async () => {
    setPdf(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
      const el = document.getElementById("recap");
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const w = 190;
      const h = (canvas.height * w) / canvas.width;
      doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 10, 10, w, Math.min(h, 277));
      doc.save(`reservation-${reference}.pdf`);
    } finally {
      setPdf(false);
    }
  };

  return (
    <>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.print()}><Printer />{t("print")}</Button>
        <Button variant="outline" loading={pdf} onClick={download}><Download />{t("downloadPdf")}</Button>
        {canExtend && <Button variant="outline" onClick={() => setExtending(true)}><CalendarPlus />{t("extend")}</Button>}
        {canCancel && <CancelReservationButton id={id} />}
      </div>
      <ExtendRequest open={extending} onOpenChange={setExtending} id={id} endDate={endDate} />
    </>
  );
}

function ExtendRequest({ open, onOpenChange, id, endDate }: { open: boolean; onOpenChange: (o: boolean) => void; id: string; endDate: string }) {
  const t = useTranslations("Account");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const min = new Date(new Date(`${endDate}T12:00:00`).getTime() + 86_400_000).toISOString().slice(0, 10);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("extendTitle")} description={t("extendBody")} closeLabel={tc("close")}>
        <div className="grid gap-4">
          <Field label={t("newEndDate")} required>{(p) => <Input {...p} type="date" min={min} value={date} onChange={(x) => setDate(x.target.value)} />}</Field>
          <Field label={t("extendNote")} optionalLabel={tc("optional")}>{(p) => <Textarea {...p} rows={2} value={note} onChange={(x) => setNote(x.target.value)} />}</Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button
            disabled={!date || date < min}
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await requestExtension(id, date, note);
                if (!r.ok) return void toast.error(r.error === "extension_pending" ? t("extensionAlready") : te(r.error as "unknown"));
                toast.success(t("extensionSent"));
                onOpenChange(false);
                router.refresh();
              })
            }
          >
            <CalendarPlus />
            {t("sendRequest")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const KINDS = ["license_front", "license_back", "id_front", "id_back"] as const;
type Kind = (typeof KINDS)[number];

/** Pièces du client : permis et carte d'identité, recto et verso. */
export function ClientDocuments({ reservationId, docs }: { reservationId: string; docs: Partial<Record<Kind, { id: number; createdAt: string }>> }) {
  const t = useTranslations("Account");
  const te = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<Kind | null>(null);
  const inputs = useRef<Partial<Record<Kind, HTMLInputElement | null>>>({});

  const upload = async (kind: Kind, file?: File) => {
    if (!file) return;
    setBusy(kind);
    try {
      const up = await uploadFile(file, "document");
      const r = await uploadClientDocument({ kind, publicId: up.publicId, resourceType: up.resourceType === "raw" ? "raw" : "image", reservationId });
      if (!r.ok) throw new Error(r.error);
      toast.success(t("docUploaded"));
      router.refresh();
    } catch (err) {
      toast.error(te(((err as Error).message as "unknown") || "unknown"));
    } finally {
      setBusy(null);
      const el = inputs.current[kind];
      if (el) el.value = "";
    }
  };
  const view = async (id: number) => {
    const r = await clientDocumentUrl(id);
    if (!r.ok) return void toast.error(te(r.error as "unknown"));
    window.open(r.data!.url, "_blank", "noopener");
  };

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-ink">{t("docsTitle")}</h2>
      <p className="mt-1 mb-4 text-sm text-ink-3">{t("docsHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {KINDS.map((k) => {
          const d = docs[k];
          return (
            <Panel key={k} className="flex items-center gap-3 p-4">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${d ? "bg-palm-soft text-palm" : "bg-mist text-ink-3"}`}>
                {d ? <Check className="size-5" /> : <FileUp className="size-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{t(`doc.${k}`)}</span>
                <span className="block text-xs text-ink-3">{d ? t("docSent", { date: formatDateTime(d.createdAt, locale) }) : t("docMissing")}</span>
              </span>
              <input ref={(el) => { inputs.current[k] = el; }} type="file" accept={ACCEPT_DOCS} capture="environment" hidden onChange={(e) => upload(k, e.target.files?.[0])} />
              {d && <Button size="icon" variant="ghost" aria-label={t("docView")} title={t("docView")} onClick={() => view(d.id)}><Eye className="size-4" /></Button>}
              <Button size="sm" variant={d ? "outline" : "primary"} loading={busy === k} onClick={() => inputs.current[k]?.click()}>
                {d ? t("docReplace") : t("docUpload")}
              </Button>
            </Panel>
          );
        })}
      </div>
    </section>
  );
}
