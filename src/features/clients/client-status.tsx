"use client";

import { MailPlus, Power, PowerOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { resendClientInvite, setClientStatus } from "@/server/actions/clients";

/** Activer / désactiver un client (jamais de suppression). Désactiver demande un motif. */
export function ClientStatusButton({
  id,
  name,
  status,
  compact = false,
  onDone,
}: {
  id: string;
  name: string;
  status: "active" | "deactivated";
  compact?: boolean;
  /** Nouvel état, pour mettre à jour la ligne du tableau tout de suite */
  onDone?: (next: "active" | "deactivated") => void;
}) {
  const t = useTranslations("Clients");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const active = status === "active";

  const confirm = () =>
    start(async () => {
      const res = await setClientStatus(id, active ? "deactivated" : "active", reason);
      if (res.ok) {
        toast.success(active ? t("deactivatedToast") : t("reactivatedToast"));
        onDone?.(active ? "deactivated" : "active");
        setOpen(false);
        setReason("");
        router.refresh();
      } else if (res.fieldErrors?.reason) setError(te("minLength", { min: 3 }));
      else toast.error(te(res.error as "unknown"));
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); }}>
      <DialogTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label={active ? t("deactivate") : t("reactivate")}
            title={active ? t("deactivate") : t("reactivate")}
            className={active ? "grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger" : "grid size-8 place-items-center rounded-lg text-palm hover:bg-palm-soft"}
          >
            {active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
          </button>
        ) : active ? (
          <Button variant="dangerOutline"><PowerOff />{t("deactivate")}</Button>
        ) : (
          <Button variant="success"><Power />{t("reactivate")}</Button>
        )}
      </DialogTrigger>
      <DialogContent title={active ? t("deactivateTitle", { name }) : t("reactivateTitle", { name })} description={active ? t("deactivateBody") : t("reactivateBody")} closeLabel={tc("close")}>
        {active && (
          <Field label={t("deactivationReason")} required error={error}>
            {(p) => <Textarea {...p} autoFocus value={reason} onChange={(x) => setReason(x.target.value)} />}
          </Field>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
          <Button variant={active ? "danger" : "success"} loading={pending} disabled={active && reason.trim().length < 3} onClick={confirm}>
            {active ? t("deactivate") : t("reactivate")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Renvoie l'invitation (choisir son mot de passe, compléter sa fiche) à un client sans compte. */
export function ClientInviteButton({ id }: { id: string }) {
  const t = useTranslations("Clients");
  const te = useTranslations("Errors");
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await resendClientInvite(id);
          if (r.ok) toast.success(t("inviteSent"));
          else toast.error(te(r.error as "unknown"));
        })
      }
    >
      <MailPlus />
      {t("sendInvite")}
    </Button>
  );
}
