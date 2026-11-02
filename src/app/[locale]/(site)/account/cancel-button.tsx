"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { cancelOwnReservation } from "@/server/actions/reservations";

export function CancelReservationButton({ id }: { id: string }) {
  const t = useTranslations("Account");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="dangerOutline" size="sm">{t("cancel")}</Button>
      </DialogTrigger>
      <DialogContent title={t("cancelTitle")} description={t("cancelBody")} closeLabel={tc("close")}>
        <Field label={t("cancelReason")}>{(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>{tc("back")}</Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await cancelOwnReservation(id, reason);
                if (res.ok) {
                  toast.success(t("cancelled"));
                  setOpen(false);
                } else toast.error(te(res.error as "unknown"));
              })
            }
          >
            {t("cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
