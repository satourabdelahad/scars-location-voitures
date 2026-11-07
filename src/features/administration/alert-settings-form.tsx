"use client";

import { ClipboardList, Droplets, Save, ShieldCheck, Stamp, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Panel } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { updateAlertSettings } from "@/server/actions/admin-settings";

type V = { insuranceDays: number; vignetteDays: number; oilDays: number; oilKm: number; inspectionDays: number; availableHours: number };

/** Seuils des alertes : combien de jours (ou de km) avant l'échéance une voiture apparaît dans les alertes. */
export function AlertSettingsForm({ initial }: { initial: V }) {
  const t = useTranslations("AlertSettings");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [v, setV] = useState<Record<keyof V, string>>(Object.fromEntries(Object.entries(initial).map(([k, x]) => [k, String(x)])) as Record<keyof V, string>);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const rows: { key: keyof V; icon: React.ReactNode; unit: "days" | "km" | "hours" }[] = [
    { key: "insuranceDays", icon: <ShieldCheck />, unit: "days" },
    { key: "oilDays", icon: <Droplets />, unit: "days" },
    { key: "oilKm", icon: <Droplets />, unit: "km" },
    { key: "vignetteDays", icon: <Stamp />, unit: "days" },
    { key: "inspectionDays", icon: <ClipboardList />, unit: "days" },
    { key: "availableHours", icon: <CircleCheck />, unit: "hours" },
  ];
  return (
    <Panel className="max-w-3xl p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        {rows.map((r) => (
          <Field key={r.key} label={t(r.key)} hint={t(`${r.key}Hint`)} error={errors[r.key] ? te(errors[r.key] as "number") : undefined}>
            {(p) => (
              <div className="relative">
                <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3 [&_svg]:size-4">{r.icon}</span>
                <Input {...p} type="number" min={0} className="ps-9 pe-16" value={v[r.key]} onChange={(e) => setV((s) => ({ ...s, [r.key]: e.target.value }))} />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-ink-3">{t(`unit.${r.unit}`)}</span>
              </div>
            )}
          </Field>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await updateAlertSettings(v);
              if (!r.ok) {
                if (r.fieldErrors) setErrors(r.fieldErrors);
                return void toast.error(te(r.error as "unknown"));
              }
              setErrors({});
              toast.success(tc("saved"));
              router.refresh();
            })
          }
        >
          <Save />
          {tc("save")}
        </Button>
      </div>
    </Panel>
  );
}
