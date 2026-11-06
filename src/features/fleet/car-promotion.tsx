"use client";

import { Percent, Save, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge, Panel } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { promoPrice, promoState } from "@/lib/car-promo";
import { formatDate, formatMoney, todayISO } from "@/lib/utils";
import { setCarPromotion } from "@/server/actions/fleet";

/** Onglet « Promotion » de la fiche voiture : remise en % sur le prix par jour, avec dates facultatives. */
export function CarPromotion({
  carId,
  dailyPrice,
  initial,
  frozen,
}: {
  carId: string;
  dailyPrice: number;
  initial: { promoPercent: number | null; promoStartsOn: string | null; promoEndsOn: string | null };
  frozen: boolean;
}) {
  const t = useTranslations("Fleet");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ percent: initial.promoPercent ? String(initial.promoPercent) : "", startsOn: initial.promoStartsOn ?? "", endsOn: initial.promoEndsOn ?? "" });
  const [error, setError] = useState<string | null>(null);
  const pct = Number(v.percent);
  const valid = Number.isInteger(pct) && pct >= 1 && pct <= 90;
  const st = promoState(initial, todayISO());

  const save = (remove = false) => {
    setError(null);
    if (!remove && !valid) return setError(t("promoPercentError"));
    if (!remove && v.startsOn && v.endsOn && v.endsOn < v.startsOn) return setError(te("dateOrder"));
    start(async () => {
      const r = await setCarPromotion(carId, remove ? null : { percent: pct, startsOn: v.startsOn || null, endsOn: v.endsOn || null });
      if (!r.ok) return void toast.error(te(r.error as "unknown"));
      if (remove) setV({ percent: "", startsOn: "", endsOn: "" });
      toast.success(remove ? t("promoRemoved") : t("promoSaved"));
      router.refresh();
    });
  };

  return (
    <Panel className="p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
            <Percent className="size-4 text-majorelle" />
            {t("tabPromotion")}
          </h2>
          <p className="mt-1 text-sm text-ink-3">{t("promoTabHint")}</p>
          {st !== "none" && (
            <p className="mt-3">
              <Badge tone={st === "active" ? "warning" : "neutral"} dot>
                -{initial.promoPercent} % · {t(`promoState.${st}`)}
              </Badge>
            </p>
          )}
        </div>
        <div className="grid max-w-xl gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("promoPercent")} required error={error ?? undefined}>
              {(p) => <Input {...p} type="number" min={1} max={90} inputMode="numeric" disabled={frozen} value={v.percent} onChange={(e) => setV({ ...v, percent: e.target.value })} />}
            </Field>
            <Field label={t("promoStartsOn")} optionalLabel={tc("optional")}>
              {(p) => <Input {...p} type="date" disabled={frozen} value={v.startsOn} onChange={(e) => setV({ ...v, startsOn: e.target.value })} />}
            </Field>
            <Field label={t("promoEndsOn")} optionalLabel={tc("optional")}>
              {(p) => <Input {...p} type="date" disabled={frozen} min={v.startsOn || undefined} value={v.endsOn} onChange={(e) => setV({ ...v, endsOn: e.target.value })} />}
            </Field>
          </div>
          {valid && (
            <p className="rounded-xl bg-saffron/15 px-4 py-3 text-sm text-saffron-ink">
              {t("promoPreview", { before: formatMoney(dailyPrice, locale), after: formatMoney(promoPrice(dailyPrice, pct), locale) })}
              {v.startsOn || v.endsOn ? ` · ${[v.startsOn && formatDate(v.startsOn, locale), v.endsOn && formatDate(v.endsOn, locale)].filter(Boolean).join(" → ")}` : ` · ${t("promoNoEnd")}`}
            </p>
          )}
          <p className="text-xs text-ink-3">{t("promoHint")}</p>
          {!frozen && (
            <div className="flex flex-wrap justify-end gap-2">
              {initial.promoPercent && (
                <Button variant="dangerOutline" onClick={() => save(true)} disabled={pending}>
                  <Trash2 />
                  {t("promoRemove")}
                </Button>
              )}
              <Button onClick={() => save()} loading={pending}>
                <Save />
                {tc("save")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
