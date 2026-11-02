"use client";

import { Ban } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { deactivateCar } from "@/server/actions/fleet";

const REASONS = ["stolen", "sold", "totaled", "accident", "end_of_lease", "other"] as const;

export function DeactivateCarButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("Fleet");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const e = useTranslations("Enums");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | "">("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="dangerOutline"><Ban />{t("deactivate")}</Button>
      </DialogTrigger>
      <DialogContent title={t("deactivateTitle", { car: name })} description={t("deactivateBody")} closeLabel={tc("close")}>
        <div className="space-y-4">
          <Field label={t("deactivationReason")} required>
            {(p) => (
              <Select {...p} value={reason} onChange={(x) => setReason(x.target.value as typeof reason)}>
                <option value="">—</option>
                {REASONS.map((r) => <option key={r} value={r}>{e(`carDeactivation.${r}`)}</option>)}
              </Select>
            )}
          </Field>
          <Field label={t("deactivationNote")} optionalLabel={tc("optional")} hint={t("deactivationNoteHint")}>
            {(p) => <Textarea {...p} value={note} onChange={(x) => setNote(x.target.value)} />}
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
          <Button
            variant="danger"
            disabled={!reason}
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await deactivateCar(id, { reason, note });
                if (res.ok) {
                  toast.success(t("deactivatedToast"));
                  setOpen(false);
                  router.refresh();
                } else toast.error(te(res.error as "unknown"));
              })
            }
          >
            {t("deactivate")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
