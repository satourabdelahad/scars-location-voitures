"use client";

import { ExternalLink, Loader2, MailPlus, Power, PowerOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import type { DocumentKind } from "@/db/schema";
import type { ManagerDisplayStatus } from "@/lib/manager-status";
import { deactivateManager, getManagerDocumentUrl, reactivateManager, resendManagerInvite } from "@/server/actions/managers";

export function ManagerActions({
  id,
  name,
  status,
  canResendInvite = false,
  compact = false,
  onDone,
}: {
  id: string;
  name: string;
  /** "pending" : invité, compte pas encore activé */
  status: ManagerDisplayStatus;
  canResendInvite?: boolean;
  /** Bouton icône, pour la colonne d'actions du tableau */
  compact?: boolean;
  /** Nouvel état, pour mettre à jour la ligne tout de suite */
  onDone?: (next: { status: "active" | "deactivated"; deactivationReason: string | null }) => void;
}) {
  const t = useTranslations("Managers");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const resend = () =>
    start(async () => {
      const r = await resendManagerInvite(id);
      if (r.ok) toast.success(t("inviteSent"));
      else toast.error(te(r.error as "unknown"));
    });

  const confirm = () =>
    start(async () => {
      const res = status === "active" ? await deactivateManager(id, reason) : await reactivateManager(id);
      if (res.ok) {
        toast.success(status === "active" ? t("deactivatedToast") : t("reactivatedToast"));
        onDone?.(status === "active" ? { status: "deactivated", deactivationReason: reason.trim() } : { status: "active", deactivationReason: null });
        setOpen(false);
        setReason("");
        router.refresh();
      } else if (res.fieldErrors?.reason) setError(te("minLength", { min: 3 }));
      else toast.error(te(res.error as "unknown"));
    });

  // Invité qui n'a pas encore activé son compte : seule action possible, renvoyer l'invitation.
  if (status === "pending")
    return compact ? (
      <button
        type="button"
        disabled={pending}
        onClick={resend}
        aria-label={t("resendInvite")}
        title={t("resendInvite")}
        className="grid size-8 place-items-center rounded-lg text-majorelle hover:bg-majorelle-soft disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />}
      </button>
    ) : (
      <Button variant="outline" loading={pending} onClick={resend}>
        <MailPlus />
        {t("resendInvite")}
      </Button>
    );

  return (
    <>
      {canResendInvite && (
        <Button variant="outline" onClick={resend}>
          <MailPlus />
          {t("resendInvite")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); }}>
        <DialogTrigger asChild>
          {compact ? (
            <button
              type="button"
              aria-label={status === "active" ? t("deactivate") : t("reactivate")}
              title={status === "active" ? t("deactivate") : t("reactivate")}
              className={
                status === "active"
                  ? "grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
                  : "grid size-8 place-items-center rounded-lg text-palm hover:bg-palm-soft"
              }
            >
              {status === "active" ? <PowerOff className="size-4" /> : <Power className="size-4" />}
            </button>
          ) : status === "active" ? (
            <Button variant="dangerOutline"><PowerOff />{t("deactivate")}</Button>
          ) : (
            <Button variant="success"><Power />{t("reactivate")}</Button>
          )}
        </DialogTrigger>
        <DialogContent
          title={status === "active" ? t("deactivateTitle", { name }) : t("reactivateTitle", { name })}
          description={status === "active" ? t("deactivateBody") : t("reactivateBody")}
          closeLabel={tc("close")}
        >
          {status === "active" && (
            <Field label={t("deactivationReason")} required hint={t("deactivationReasonHint")} error={error}>
              {(p) => <Textarea {...p} autoFocus value={reason} onChange={(x) => setReason(x.target.value)} />}
            </Field>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button
              variant={status === "active" ? "danger" : "success"}
              loading={pending}
              disabled={status === "active" && reason.trim().length < 3}
              onClick={confirm}
            >
              {status === "active" ? t("deactivate") : t("reactivate")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Ouvre la pièce via un lien signé, valable quelques minutes. */
export function DocumentLink({ managerId, kind }: { managerId: string; kind: DocumentKind }) {
  const td = useTranslations("Documents");
  const te = useTranslations("Errors");
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await getManagerDocumentUrl(managerId, kind);
          if (r.ok) window.open(r.data!.url, "_blank", "noopener");
          else toast.error(te(r.error as "unknown"));
        })
      }
    >
      {!pending && <ExternalLink />}
      {td("open")}
    </Button>
  );
}
