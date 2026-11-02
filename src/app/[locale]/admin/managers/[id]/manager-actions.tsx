"use client";

import { ExternalLink, MailPlus, Power, PowerOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import type { DocumentKind } from "@/db/schema";
import { deactivateManager, getManagerDocumentUrl, reactivateManager, resendManagerInvite } from "@/server/actions/managers";

export function ManagerActions({ id, name, status, canResendInvite }: { id: string; name: string; status: "active" | "deactivated"; canResendInvite: boolean }) {
  const t = useTranslations("Managers");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const confirm = () =>
    start(async () => {
      const res = status === "active" ? await deactivateManager(id, reason) : await reactivateManager(id);
      if (res.ok) {
        toast.success(status === "active" ? t("deactivatedToast") : t("reactivatedToast"));
        setOpen(false);
        setReason("");
        router.refresh();
      } else if (res.fieldErrors?.reason) setError(te("minLength", { min: 3 }));
      else toast.error(te(res.error as "unknown"));
    });

  return (
    <>
      {canResendInvite && (
        <Button
          variant="outline"
          onClick={() => start(async () => {
            const r = await resendManagerInvite(id);
            if (r.ok) toast.success(t("inviteSent"));
            else toast.error(te(r.error as "unknown"));
          })}
        >
          <MailPlus />
          {t("resendInvite")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); }}>
        <DialogTrigger asChild>
          {status === "active" ? (
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
