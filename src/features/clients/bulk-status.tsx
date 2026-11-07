"use client";

import { UserRoundCheck, UserRoundX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { setClientsStatus } from "@/server/actions/clients";

type Status = "active" | "deactivated";

/** Activer ou désactiver les clients sélectionnés (motif obligatoire pour désactiver). */
export function BulkStatusActions({ selected, onDone }: { selected: { id: string; status: Status; firstName: string; lastName: string }[]; onDone?: (ids: string[], status: Status) => void }) {
  const t = useTranslations("Clients");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const toOff = selected.filter((c) => c.status === "active");
  const toOn = selected.filter((c) => c.status !== "active");

  const run = (status: Status, rows: typeof selected) =>
    start(async () => {
      const r = await setClientsStatus(rows.map((x) => x.id), status, status === "deactivated" ? reason : undefined);
      if (!r.ok) return void toast.error(te(r.error as "unknown"));
      toast.success(t(status === "active" ? "bulkActivated" : "bulkDeactivated", { count: r.data!.done }));
      onDone?.(rows.slice(0, r.data!.done).map((x) => x.id), status);
      setAsking(false);
      setReason("");
      router.refresh();
    });

  return (
    <>
      {toOn.length > 0 && (
        <Button size="sm" variant="outline" loading={pending && !asking} onClick={() => run("active", toOn)}>
          <UserRoundCheck />
          {t("bulkActivate")} {selected.length > 1 && `(${toOn.length})`}
        </Button>
      )}
      {toOff.length > 0 && (
        <Button size="sm" variant="dangerOutline" disabled={pending} onClick={() => setAsking(true)}>
          <UserRoundX />
          {t("bulkDeactivate")} {selected.length > 1 && `(${toOff.length})`}
        </Button>
      )}
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent title={t("bulkDeactivateTitle", { count: toOff.length })} closeLabel={tc("close")}>
          <p className="mb-3 text-sm text-ink-2">{toOff.map((c) => `${c.firstName} ${c.lastName}`).join(", ")}</p>
          <Field label={t("bulkDeactivateReason")} required>{(p) => <Textarea {...p} autoFocus value={reason} onChange={(x) => setReason(x.target.value)} />}</Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAsking(false)}>{tc("cancel")}</Button>
            <Button variant="danger" loading={pending} disabled={reason.trim().length < 3} onClick={() => run("deactivated", toOff)}>
              <UserRoundX />
              {t("bulkDeactivate")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
