import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/ui/misc";
import { intlLocale } from "@/i18n/config";
import { cn, formatMoney } from "@/lib/utils";
import type { CarFinance } from "@/server/queries/car-file";

/** Dépenses et rentabilité : chiffre d'affaires, dépenses, marge, amortissement de l'achat et 12 derniers mois. */
export async function FinancePanel({ data, locale }: { data: CarFinance; locale: string }) {
  const t = await getTranslations("CarFile");
  const e = await getTranslations("Enums");
  const max = Math.max(1, ...data.months.flatMap((m) => [m.revenue, m.expenses]));
  const monthLabel = (m: string) => new Intl.DateTimeFormat(intlLocale(locale), { month: "short" }).format(new Date(`${m}-15T12:00:00`));
  const tiles = [
    { label: t("finance.revenue"), value: formatMoney(data.revenue, locale), sub: t("finance.rentals", { count: data.rentals, days: data.rentedDays }) },
    { label: t("finance.expenses"), value: formatMoney(data.expenses, locale), sub: t("finance.expensesSub") },
    { label: t("finance.margin"), value: formatMoney(data.margin, locale), tone: data.margin >= 0 ? "text-palm" : "text-danger", sub: data.revenue ? t("finance.marginRate", { percent: Math.round((data.margin / data.revenue) * 100) }) : "—" },
    {
      label: t("finance.recovery"),
      value: data.toRecover == null ? "—" : data.toRecover <= 0 ? t("finance.paidOff") : formatMoney(data.toRecover, locale),
      sub: data.purchasePrice == null ? t("finance.noPurchase") : t("finance.purchase", { price: formatMoney(data.purchasePrice, locale) }),
    },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((x) => (
          <Panel key={x.label} className="p-5">
            <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{x.label}</p>
            <p className={cn("mt-2 text-2xl font-extrabold text-ink tabular", x.tone)}>{x.value}</p>
            <p className="mt-1 text-xs text-ink-3">{x.sub}</p>
          </Panel>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-ink">{t("finance.months")}</h3>
            <div className="flex gap-3 text-xs text-ink-3">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-majorelle" />{t("finance.revenue")}</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-saffron" />{t("finance.expenses")}</span>
            </div>
          </div>
          <div className="flex h-48 items-end gap-2" role="img" aria-label={t("finance.months")}>
            {data.months.map((m) => (
              <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div className="flex h-full w-full items-end justify-center gap-0.5">
                  <div className="w-1/2 max-w-4 rounded-t bg-majorelle" style={{ height: `${(m.revenue / max) * 100}%` }} title={`${formatMoney(m.revenue, locale)}`} />
                  <div className="w-1/2 max-w-4 rounded-t bg-saffron" style={{ height: `${(m.expenses / max) * 100}%` }} title={`${formatMoney(m.expenses, locale)}`} />
                </div>
                <span className="text-[10px] text-ink-3 capitalize">{monthLabel(m.month)}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-3 text-sm font-bold text-ink">{t("finance.byType")}</h3>
          {data.byKind.length === 0 ? (
            <p className="text-sm text-ink-3">{t("finance.noExpense")}</p>
          ) : (
            <ul className="space-y-2.5">
              {data.byKind.map((k) => (
                <li key={`${k.kind}-${k.category}`} className="text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-2">{k.kind === "expense" && k.category ? e(`expenseCategory.${k.category}`) : t(`${k.kind}.tab`)}</span>
                    <span className="font-semibold text-ink tabular">{formatMoney(k.amount, locale)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-mist">
                    <div className="h-full rounded-full bg-saffron" style={{ width: `${(k.amount / data.expenses) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
