"use client";

import { ArrowDown, ArrowUp, Plus, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Panel } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { cn, formatMoney } from "@/lib/utils";
import { saveExtras } from "@/server/actions/admin-settings";

type Row = { id?: number; name: string; price: number | string; pricing: "per_day" | "once"; isActive: boolean };

/** Suppléments proposés à la réservation, et prix du chauffeur. */
export function ExtrasForm({ initial, booking, locale }: { initial: Row[]; booking: { driverPricePerDay: number; responseHours: number }; locale: string }) {
  const t = useTranslations("ExtrasAdmin");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [b, setB] = useState({ driverPricePerDay: String(booking.driverPricePerDay), responseHours: String(booking.responseHours) });
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const n = [...r];
      const j = i + d;
      if (j < 0 || j >= n.length) return r;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Panel className="overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-chalk text-xs font-semibold text-ink-3">
              <tr>
                <th className="w-16 px-3 py-2.5" />
                <th className="px-3 py-2.5 text-start">{t("name")}</th>
                <th className="w-36 px-3 py-2.5 text-start">{t("price")}</th>
                <th className="w-40 px-3 py-2.5 text-start">{t("pricing")}</th>
                <th className="w-24 px-3 py-2.5 text-start">{t("active")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {rows.map((x, i) => (
                <tr key={x.id ?? `new-${i}`} className={cn(!x.isActive && "opacity-60")}>
                  <td className="px-2 py-2">
                    <div className="flex">
                      <button type="button" aria-label={t("up")} onClick={() => move(i, -1)} className="grid size-7 place-items-center rounded text-ink-3 hover:bg-mist hover:text-ink"><ArrowUp className="size-3.5" /></button>
                      <button type="button" aria-label={t("down")} onClick={() => move(i, 1)} className="grid size-7 place-items-center rounded text-ink-3 hover:bg-mist hover:text-ink"><ArrowDown className="size-3.5" /></button>
                    </div>
                  </td>
                  <td className="px-3 py-2"><Input aria-label={t("name")} value={x.name} onChange={(e) => set(i, { name: e.target.value })} /></td>
                  <td className="px-3 py-2">
                    <Input aria-label={t("price")} type="number" min={0} step="0.01" value={x.price} onChange={(e) => set(i, { price: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Select aria-label={t("pricing")} value={x.pricing} onChange={(e) => set(i, { pricing: e.target.value as Row["pricing"] })}>
                      <option value="per_day">{t("perDay")}</option>
                      <option value="once">{t("once")}</option>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={t("active")} checked={x.isActive} onChange={(e) => set(i, { isActive: e.target.checked })} className="size-4 accent-[var(--majorelle)]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist p-4">
          <Button variant="outline" onClick={() => setRows((r) => [...r, { name: "", price: 0, pricing: "once", isActive: true }])}>
            <Plus />
            {t("add")}
          </Button>
          <p className="text-xs text-ink-3">{t("neverDeleted")}</p>
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel className="space-y-4 p-5">
          <Field label={t("driverPrice")} hint={t("driverPriceHint", { example: formatMoney(Number(b.driverPricePerDay) || 0, locale) })}>
            {(p) => <Input {...p} type="number" min={0} step="1" value={b.driverPricePerDay} onChange={(e) => setB((s) => ({ ...s, driverPricePerDay: e.target.value }))} />}
          </Field>
          <Field label={t("responseHours")} hint={t("responseHoursHint")}>
            {(p) => <Input {...p} type="number" min={1} max={72} value={b.responseHours} onChange={(e) => setB((s) => ({ ...s, responseHours: e.target.value }))} />}
          </Field>
        </Panel>
        <Button
          className="w-full"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await saveExtras(
                rows.map((x) => ({ ...x, price: Number(x.price) || 0 })),
                b,
              );
              if (!r.ok) return void toast.error(te(r.error as "unknown"));
              toast.success(tc("saved"));
              router.refresh();
            })
          }
        >
          <Save />
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
