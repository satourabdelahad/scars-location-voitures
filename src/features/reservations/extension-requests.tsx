"use client";

import { CheckCircle2, Eye, FileX, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { decideExtension } from "@/server/actions/reservations";
import { clientDocumentUrl } from "@/server/actions/client-space";

export type ExtensionRow = {
  id: string;
  fromEndDate: string;
  requestedEndDate: string;
  status: "pending" | "accepted" | "refused";
  note: string | null;
  reason: string | null;
  createdAt: string;
};

/** Demandes de prolongation du client : l'administrateur ou le responsable accepte ou refuse. */
export function ExtensionRequests({ rows, canValidate, focus }: { rows: ExtensionRow[]; canValidate: boolean; focus?: { id: string; decide: "accept" | "refuse" } | null }) {
  const t = useTranslations("Reservations");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const focusable = focus && canValidate && rows.some((r) => r.id === focus.id && r.status === "pending");
  const [refusing, setRefusing] = useState<string | null>(focusable && focus!.decide === "refuse" ? focus!.id : null);
  const [reason, setReason] = useState("");

  const decide = (id: string, accept: boolean, why?: string) =>
    start(async () => {
      const r = await decideExtension(id, accept, why);
      if (!r.ok) return void toast.error(te(r.error as "unknown"));
      toast.success(t("updated"));
      setRefusing(null);
      setReason("");
      router.refresh();
    });

  if (!rows.length) return null;
  return (
    <div>
      <h2 className="mb-4 font-bold text-ink">{t("extensionRequests")}</h2>
      <ul className="space-y-3">
        {rows.map((x) => {
          const hl = focusable && focus!.id === x.id && x.status === "pending";
          return (
            <li key={x.id} className={cn("rounded-xl border border-mist p-4", hl && "ring-2 ring-majorelle")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">
                  {formatDate(x.fromEndDate, locale)} → {formatDate(x.requestedEndDate, locale)}
                </p>
                <Badge tone={x.status === "accepted" ? "success" : x.status === "refused" ? "danger" : "warning"} dot>
                  {t(`extensionStatus.${x.status}`)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-ink-3">{formatDateTime(x.createdAt, locale)}</p>
              {x.note && <p className="mt-2 text-sm text-ink-2">{x.note}</p>}
              {x.reason && <p className="mt-2 text-sm text-danger">{x.reason}</p>}
              {x.status === "pending" && canValidate && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" loading={pending && !refusing} onClick={() => decide(x.id, true)}><CheckCircle2 />{t("acceptExtension")}</Button>
                  <Button size="sm" variant="dangerOutline" onClick={() => setRefusing(x.id)}><XCircle />{t("refuseExtension")}</Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Dialog open={refusing !== null} onOpenChange={(o) => !o && setRefusing(null)}>
        <DialogContent title={t("refuseExtension")} closeLabel={tc("close")}>
          <Field label={t("reasonLabel")} required>{(p) => <Textarea {...p} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRefusing(null)}>{tc("back")}</Button>
            <Button variant="danger" disabled={reason.trim().length < 3} loading={pending} onClick={() => refusing && decide(refusing, false, reason)}>
              {t("refuseExtension")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const KINDS = ["license_front", "license_back", "id_front", "id_back"] as const;

/** Pièces déposées par le client (permis et carte d'identité), consultables par l'équipe. */
export function StaffClientDocuments({ docs }: { docs: Partial<Record<(typeof KINDS)[number], { id: number; createdAt: string }>> }) {
  const t = useTranslations("Account");
  const tr = useTranslations("Reservations");
  const te = useTranslations("Errors");
  const locale = useLocale();
  const view = async (id: number) => {
    const r = await clientDocumentUrl(id);
    if (!r.ok) return void toast.error(te(r.error as "unknown"));
    window.open(r.data!.url, "_blank", "noopener");
  };
  return (
    <div>
      <h2 className="mb-4 font-bold text-ink">{tr("clientDocuments")}</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {KINDS.map((k) => {
          const d = docs[k];
          return (
            <li key={k} className="flex items-center gap-2 rounded-xl bg-chalk px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{t(`doc.${k}`)}</span>
                <span className="block text-xs text-ink-3">{d ? formatDateTime(d.createdAt, locale) : t("docMissing")}</span>
              </span>
              {d ? (
                <Button size="icon" variant="ghost" aria-label={t("docView")} title={t("docView")} onClick={() => view(d.id)}><Eye className="size-4" /></Button>
              ) : (
                <FileX className="size-4 text-ink-3" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
