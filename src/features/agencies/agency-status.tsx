"use client";

import { Power, PowerOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { setAgencyActive } from "@/server/actions/agencies";

/** Désactiver (motif obligatoire) ou réactiver une agence ; jamais de suppression. Réservé à l'administrateur. */
export function AgencyStatusButton({ id, name, active, compact = false, onDone }: { id: number; name: string; active: boolean; compact?: boolean; onDone?: (active: boolean) => void }) {
  const t = useTranslations("Agencies");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const confirm = () =>
    start(async () => {
      const r = await setAgencyActive(id, !active, reason);
      if (r.ok) {
        toast.success(active ? t("deactivatedToast") : t("reactivatedToast"));
        onDone?.(!active);
        setOpen(false);
        setReason("");
        router.refresh();
      } else toast.error(te(r.error as "unknown"));
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent title={active ? t("deactivateTitle", { name }) : t("reactivateTitle", { name })} description={active ? t("deactivateBody") : undefined} closeLabel={tc("close")}>
        {active && (
          <Field label={t("reason")} required>
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
