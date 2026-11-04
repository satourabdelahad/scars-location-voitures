"use client";

import { LockOpen, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/utils";
import { unlockUser, updateSecuritySettings } from "@/server/actions/security-settings";
import type { SecuritySettings } from "@/server/settings";

const FIELDS: { key: keyof SecuritySettings; min: number; max: number; unit: "attempts" | "minutes" | "hours" | "days" }[] = [
  { key: "maxEmailFailures", min: 3, max: 20, unit: "attempts" },
  { key: "lockMinutes", min: 1, max: 1440, unit: "minutes" },
  { key: "maxIpFailures", min: 5, max: 500, unit: "attempts" },
  { key: "staffSessionHours", min: 1, max: 168, unit: "hours" },
  { key: "clientSessionDays", min: 1, max: 90, unit: "days" },
];

export function SecuritySettingsForm({ initial }: { initial: SecuritySettings }) {
  const t = useTranslations("Security");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [v, setV] = useState<Record<keyof SecuritySettings, number | "">>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    start(async () => {
      const r = await updateSecuritySettings(v);
      if (r.ok) {
        toast.success(t("settingsSaved"));
        router.refresh();
      } else {
        if (r.fieldErrors) setErrors(r.fieldErrors);
        toast.error(te(r.error as "unknown"));
      }
    });
  }

  return (
    <form onSubmit={save} noValidate className="rounded-2xl border border-mist bg-paper p-6 sm:p-8">
      <h2 className="font-bold text-ink">{t("settingsTitle")}</h2>
      <p className="mt-0.5 text-sm text-ink-3">{t("settingsHint")}</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <Field key={f.key} label={t(`s.${f.key}`)} hint={t(`unit.${f.unit}`, { min: f.min, max: f.max })} required error={errors[f.key] ? te("numberRange", { min: f.min, max: f.max }) : undefined}>
            {(p) => (
              <Input
                {...p}
                type="number"
                min={f.min}
                max={f.max}
                value={v[f.key]}
                onChange={(x) => setV((s) => ({ ...s, [f.key]: x.target.value === "" ? "" : Number(x.target.value) }))}
              />
            )}
          </Field>
        ))}
      </div>
      <div className="mt-6 flex justify-end border-t border-mist pt-5">
        <Button type="submit" loading={pending}>
          <Save />
          {t("settingsSave")}
        </Button>
      </div>
    </form>
  );
}

export type LockedAccount = { id: string; name: string | null; email: string | null; role: string; until: string };

export function LockedAccounts({ rows }: { rows: LockedAccount[] }) {
  const t = useTranslations("Security");
  const tb = useTranslations("Back");
  const te = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="rounded-2xl border border-mist bg-paper p-6">
      <h2 className="font-bold text-ink">{t("lockedTitle")}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">{t("lockedNone")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-mist">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{r.name ?? r.email}</span>
                <span className="block truncate text-xs text-ink-3" dir="ltr">{r.email}</span>
                <span className="text-xs text-ink-3">{t("lockedUntil", { date: formatDateTime(r.until, locale) })}</span>
              </span>
              <Badge tone="neutral">{r.role === "admin" ? tb("roleAdmin") : r.role === "manager" ? tb("roleManager") : tb("roleClient")}</Badge>
              <Button
                size="sm"
                variant="outline"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const res = await unlockUser(r.id);
                    if (res.ok) {
                      toast.success(t("unlocked"));
                      router.refresh();
                    } else toast.error(te(res.error as "unknown"));
                  })
                }
              >
                <LockOpen />
                {t("unlock")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
