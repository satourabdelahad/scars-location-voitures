"use client";

import { ShieldBan, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { setClientsBlacklist } from "@/server/actions/clients";

/** Ajout à la liste noire (motif obligatoire) ou retrait, pour un ou plusieurs clients. */
export function BlacklistActions({
  selected,
  onDone,
  size = "sm",
}: {
  selected: { id: string; blacklisted: boolean; firstName: string; lastName: string }[];
  onDone?: (ids: string[], on: boolean, reason: string) => void;
  size?: "sm" | "md";
}) {
  const t = useTranslations("Clients");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const toAdd = selected.filter((c) => !c.blacklisted);
  const toRemove = selected.filter((c) => c.blacklisted);

  const run = (on: boolean, rows: typeof selected) =>
    start(async () => {
      const r = await setClientsBlacklist(rows.map((x) => x.id), on, on ? reason : undefined);
      if (!r.ok) return void toast.error(te(r.error as "unknown"));
      toast.success(t(on ? "blacklistAdded" : "blacklistRemoved", { count: r.data!.done }));
      onDone?.(rows.map((x) => x.id), on, reason);
      setAsking(false);
      setReason("");
      router.refresh();
    });

  return (
    <>
      {toAdd.length > 0 && (
        <Button size={size} variant="dangerOutline" disabled={pending} onClick={() => setAsking(true)}>
          <ShieldBan />
          {t("addBlacklist")} {selected.length > 1 && `(${toAdd.length})`}
        </Button>
      )}
      {toRemove.length > 0 && (
        <Button size={size} variant="outline" loading={pending && !asking} onClick={() => run(false, toRemove)}>
          <ShieldCheck />
          {t("removeBlacklist")} {selected.length > 1 && `(${toRemove.length})`}
        </Button>
      )}
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent title={t("blacklistTitle", { count: toAdd.length })} description={t("blacklistBody")} closeLabel={tc("close")}>
          <p className="mb-3 text-sm text-ink-2">{toAdd.map((c) => `${c.firstName} ${c.lastName}`).join(", ")}</p>
          <Field label={t("blacklistReason")} required>
            {(p) => <Textarea {...p} autoFocus value={reason} onChange={(x) => setReason(x.target.value)} />}
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAsking(false)}>{tc("cancel")}</Button>
            <Button variant="danger" loading={pending} disabled={reason.trim().length < 3} onClick={() => run(true, toAdd)}>
              <ShieldBan />
              {t("addBlacklist")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
