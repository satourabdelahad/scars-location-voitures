"use client";

import { Ban, CalendarPlus, CheckCircle2, ClipboardCheck, FileSignature, KeyRound, ShieldAlert, Undo2, XCircle } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Link, useRouter } from "@/i18n/navigation";
import type { ReservationStatus } from "@/db/schema";
import { extendReservation, saveInternalNote, transitionReservation } from "@/server/actions/reservations";

export type ReservationExtras = {
  base: string;
  carId: string;
  endDate: string;
  blacklisted: string | null;
  license: { number: string; expiresOn: string };
  /** Liens WhatsApp pré-remplis (confirmation, rappel la veille, retour) ; null sans numéro */
  whatsapp: { confirm: string; reminder: string; return: string } | null;
};

type Action = "confirm" | "reject" | "pickup" | "return" | "cancel";

export function ReservationActions({
  id,
  status,
  internalNote,
  canValidate,
  responsible,
  more,
  openPickup = false,
  decide = null,
}: {
  /** Arrivée depuis l'email (bouton Accepter ou Refuser) */
  decide?: "confirm" | "reject" | null;
  id: string;
  status: ReservationStatus;
  internalNote: string | null;
  canValidate: boolean;
  responsible: string | null;
  more: ReservationExtras;
  /** Ouvre la vérification du permis à l'arrivée (depuis la liste) */
  openPickup?: boolean;
}) {
  const t = useTranslations("Reservations");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const fromEmail = status === "pending" && canValidate ? decide : null;
  const [asking, setAsking] = useState<Action | null>(fromEmail === "reject" ? "reject" : null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState(internalNote ?? "");
  const [licenseOpen, setLicenseOpen] = useState(openPickup && status === "confirmed");
  const [extendOpen, setExtendOpen] = useState(false);

  const run = (action: Action, opts: { reason?: string; license?: unknown } = {}) =>
    start(async () => {
      const res = await transitionReservation(id, action, opts);
      if (res.ok) {
        toast.success(t("updated"));
        setAsking(null);
        setReason("");
        setLicenseOpen(false);
        router.refresh();
      } else toast.error(te(res.error as "unknown"));
    });

  const buttons: { action: Action; label: string; icon: typeof Ban; variant: "primary" | "dangerOutline" | "success" | "outline"; ask?: boolean }[] = [];
  if (status === "pending" && canValidate) {
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
      {status === "pending" && !canValidate && (
        <p className="rounded-xl bg-saffron/15 px-4 py-3 text-sm text-saffron-ink">{responsible ? t("awaitingValidationBy", { name: responsible }) : t("awaitingValidation")}</p>
      )}
      {fromEmail === "confirm" && <p className="rounded-xl bg-majorelle/10 px-4 py-3 text-sm font-medium text-majorelle">{t("decideFromEmail")}</p>}
      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {buttons.map((b) => (
            <Button key={b.action} variant={b.variant} className={fromEmail === b.action ? "ring-4 ring-majorelle/30" : undefined} loading={pending && !asking} onClick={() => (b.action === "pickup" ? setLicenseOpen(true) : b.ask ? setAsking(b.action) : run(b.action))}>
              <b.icon />
              {b.label}
            </Button>
          ))}
        </div>
      )}
      {more.blacklisted && (
        <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span><span className="font-semibold">{t("blacklistedClient")}</span> {more.blacklisted}</span>
        </p>
      )}
      {/* Contrat, états des lieux, prolongation */}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/contract/${id}`} target="_blank" rel="noopener"><FileSignature />{t("contract")}</Link>
        </Button>
        {(status === "confirmed" || status === "ongoing") && (
          <Button asChild size="sm" variant="outline">
            <Link href={`${more.base}/fleet/${more.carId}?tab=inspections&new=departure&reservation=${id}`}><ClipboardCheck />{t("inspectionDeparture")}</Link>
          </Button>
        )}
        {(status === "ongoing" || status === "completed") && (
          <Button asChild size="sm" variant="outline">
            <Link href={`${more.base}/fleet/${more.carId}?tab=inspections&new=return&reservation=${id}`}><ClipboardCheck />{t("inspectionReturn")}</Link>
          </Button>
        )}
        {(status === "confirmed" || status === "ongoing") && (
          <Button size="sm" variant="outline" onClick={() => setExtendOpen(true)}><CalendarPlus />{t("extend")}</Button>
        )}
      </div>
      {more.whatsapp && (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">{t("whatsappTitle")}</p>
          <div className="flex flex-wrap gap-2">
            {(["confirm", "reminder", "return"] as const).map((k) => (
              <a
                key={k}
                href={more.whatsapp![k]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-3 text-[13px] font-semibold text-[#128C4B] hover:bg-[#25D366]/20 dark:text-[#5BE38E]"
              >
                <WhatsAppIcon className="size-4" />
                {t(`wa.${k}`)}
              </a>
            ))}
          </div>
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

      <LicenseDialog
        open={licenseOpen}
        onOpenChange={setLicenseOpen}
        initial={more.license}
        endDate={more.endDate}
        blocked={Boolean(more.blacklisted)}
        pending={pending}
        onConfirm={(license) => run("pickup", { license })}
      />
      <ExtendDialog open={extendOpen} onOpenChange={setExtendOpen} id={id} endDate={more.endDate} />
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
export function ReservationRowActions({ id, status, canValidate, onDone, detailHref }: { id: string; status: ReservationStatus; canValidate: boolean; onDone: (next: ReservationStatus) => void; detailHref: string }) {
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
  if (status === "pending" && canValidate) {
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
          // La remise des clés passe par la vérification du permis, sur la fiche de la réservation.
          onClick={() => (b.action === "pickup" ? router.push(`${detailHref}?pickup=1`) : b.ask ? setAsking(b.action) : run(b.action))}
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

/** Remise des clés : le permis est vérifié (numéro, validité jusqu'au retour, original présenté). */
function LicenseDialog({
  open,
  onOpenChange,
  initial,
  endDate,
  blocked,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: { number: string; expiresOn: string };
  endDate: string;
  blocked: boolean;
  pending: boolean;
  onConfirm: (license: { number: string; expiresOn: string; checked: true }) => void;
}) {
  const t = useTranslations("Reservations");
  const tc = useTranslations("Common");
  const [num, setNum] = useState(initial.number);
  const [exp, setExp] = useState(initial.expiresOn);
  const [checked, setChecked] = useState(false);
  const expired = Boolean(exp) && exp < endDate;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("licenseTitle")} description={t("licenseBody")} closeLabel={tc("close")}>
        {blocked ? (
          <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{t("licenseBlacklisted")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("licenseNumber")} required>{(p) => <Input {...p} dir="ltr" value={num} onChange={(x) => setNum(x.target.value)} />}</Field>
            <Field label={t("licenseExpires")} required error={expired ? t("licenseExpiredBefore") : undefined}>
              {(p) => <Input {...p} type="date" value={exp} onChange={(x) => setExp(x.target.value)} />}
            </Field>
            <Checkbox className="sm:col-span-2" checked={checked} onChange={(x) => setChecked(x.target.checked)} label={t("licenseChecked")} />
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button disabled={blocked || !checked || num.trim().length < 3 || !exp || expired} loading={pending} onClick={() => onConfirm({ number: num.trim(), expiresOn: exp, checked: true })}>
            <KeyRound />
            {t("markPickedUp")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Prolongation : nouvelle date de retour, prix recalculé. */
function ExtendDialog({ open, onOpenChange, id, endDate }: { open: boolean; onOpenChange: (o: boolean) => void; id: string; endDate: string }) {
  const t = useTranslations("Reservations");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [date, setDate] = useState("");
  const [pending, start] = useTransition();
  const min = new Date(new Date(`${endDate}T12:00:00`).getTime() + 86_400_000).toISOString().slice(0, 10);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("extendTitle")} description={t("extendBody")} closeLabel={tc("close")}>
        <Field label={t("newEndDate")} required>{(p) => <Input {...p} type="date" min={min} value={date} onChange={(x) => setDate(x.target.value)} />}</Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button
            disabled={!date || date < min}
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await extendReservation(id, date);
                if (!r.ok) return void toast.error(te(r.error as "unknown"));
                toast.success(t("extended", { days: r.data!.days }));
                onOpenChange(false);
                router.refresh();
              })
            }
          >
            <CalendarPlus />
            {t("extend")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
