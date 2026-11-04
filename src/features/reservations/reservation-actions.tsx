"use client";

import { Ban, CheckCircle2, KeyRound, Undo2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import type { ReservationStatus } from "@/db/schema";
import { saveInternalNote, transitionReservation } from "@/server/actions/reservations";

type Action = "confirm" | "reject" | "pickup" | "return" | "cancel";

export function ReservationActions({ id, status, internalNote }: { id: string; status: ReservationStatus; internalNote: string | null }) {
  const t = useTranslations("Reservations");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState(internalNote ?? "");

  const run = (action: Action, opts: { reason?: string } = {}) =>
    start(async () => {
      const res = await transitionReservation(id, action, opts);
      if (res.ok) {
        toast.success(t("updated"));
        setAsking(null);
        setReason("");
        router.refresh();
      } else toast.error(te(res.error as "unknown"));
    });

  const buttons: { action: Action; label: string; icon: typeof Ban; variant: "primary" | "dangerOutline" | "success" | "outline"; ask?: boolean }[] = [];
  if (status === "pending") {
    buttons.push({ action: "confirm", label: t("confirm"), icon: CheckCircle2, variant: "primary" });
    buttons.push({ action: "reject", label: t("reject"), icon: XCircle, variant: "dangerOutline", ask: true });
  }
  if (status === "confirmed") {
    buttons.push({ action: "pickup", label: t("markPickedUp"), icon: KeyRound, variant: "primary" });
    buttons.push({ action: "cancel", label: t("cancel"), icon: Ban, variant: "dangerOutline", ask: true });
  }
  if (status === "ongoing") buttons.push({ action: "return", label: t("markReturned"), icon: Undo2, variant: "success" });

  return (
    <div className="space-y-5">
      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {buttons.map((b) => (
            <Button key={b.action} variant={b.variant} loading={pending && !asking} onClick={() => (b.ask ? setAsking(b.action) : run(b.action))}>
              <b.icon />
              {b.label}
            </Button>
          ))}
        </div>
      )}
      <div>
        <Field label={t("internalNote")}>{(p) => <Textarea {...p} value={note} onChange={(x) => setNote(x.target.value)} rows={3} />}</Field>
        <div className="mt-2 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={note === (internalNote ?? "")}
            onClick={() => start(async () => {
              const r = await saveInternalNote(id, note);
              if (r.ok) { toast.success(tc("saved")); router.refresh(); } else toast.error(te(r.error as "unknown"));
            })}
          >
            {tc("save")}
          </Button>
        </div>
      </div>

      <Dialog open={asking !== null} onOpenChange={(o) => !o && setAsking(null)}>
        <DialogContent title={asking === "reject" ? t("rejectTitle") : t("cancel")} closeLabel={tc("close")}>
          <Field label={t("reasonLabel")} required>{(p) => <Textarea {...p} autoFocus value={reason} onChange={(x) => setReason(x.target.value)} />}</Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAsking(null)}>{tc("back")}</Button>
            <Button variant="danger" disabled={reason.trim().length < 3} loading={pending} onClick={() => asking && run(asking, { reason })}>
              {asking === "reject" ? t("reject") : t("cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const NEXT_STATUS: Record<Action, ReservationStatus> = { confirm: "confirmed", reject: "rejected", pickup: "ongoing", return: "completed", cancel: "cancelled" };

/** Actions rapides dans la colonne du tableau ; la ligne affiche le nouvel état tout de suite (onDone). */
export function ReservationRowActions({ id, status, onDone }: { id: string; status: ReservationStatus; onDone: (next: ReservationStatus) => void }) {
  const t = useTranslations("Reservations");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState<Action | null>(null);
  const [reason, setReason] = useState("");

  const run = (action: Action, opts: { reason?: string } = {}) =>
    start(async () => {
      const res = await transitionReservation(id, action, opts);
      if (res.ok) {
        toast.success(t("updated"));
        onDone(NEXT_STATUS[action]);
        setAsking(null);
        setReason("");
        router.refresh();
      } else toast.error(te(res.error as "unknown"));
    });

  const items: { action: Action; label: string; icon: typeof Ban; tone: string; ask?: boolean }[] = [];
  if (status === "pending") {
    items.push({ action: "confirm", label: t("confirm"), icon: CheckCircle2, tone: "text-palm hover:bg-palm-soft" });
    items.push({ action: "reject", label: t("reject"), icon: XCircle, tone: "text-ink-3 hover:bg-danger-soft hover:text-danger", ask: true });
  }
  if (status === "confirmed") {
    items.push({ action: "pickup", label: t("markPickedUp"), icon: KeyRound, tone: "text-majorelle hover:bg-majorelle-soft" });
    items.push({ action: "cancel", label: t("cancel"), icon: Ban, tone: "text-ink-3 hover:bg-danger-soft hover:text-danger", ask: true });
  }
  if (status === "ongoing") items.push({ action: "return", label: t("markReturned"), icon: Undo2, tone: "text-palm hover:bg-palm-soft" });
  if (!items.length) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      {items.map((b) => (
        <button
          key={b.action}
          type="button"
          disabled={pending}
          onClick={() => (b.ask ? setAsking(b.action) : run(b.action))}
          title={b.label}
          aria-label={b.label}
          className={`grid size-8 place-items-center rounded-lg disabled:opacity-50 ${b.tone}`}
        >
          <b.icon className="size-4" />
        </button>
      ))}
      <Dialog open={asking !== null} onOpenChange={(o) => !o && setAsking(null)}>
        <DialogContent title={asking === "reject" ? t("rejectTitle") : t("cancel")} closeLabel={tc("close")}>
          <Field label={t("reasonLabel")} required>
            {(p) => <Textarea {...p} autoFocus value={reason} onChange={(x) => setReason(x.target.value)} />}
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAsking(null)}>{tc("cancel")}</Button>
            <Button variant="danger" disabled={reason.trim().length < 3} loading={pending} onClick={() => asking && run(asking, { reason })}>
              {asking === "reject" ? t("reject") : t("cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
