import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge, PageHeader, Panel, reservationTone } from "@/components/ui/misc";
import { dashboardStats, todayMovements } from "@/server/queries/reservations";
import { formatDate, formatMoney } from "@/lib/utils";
import type { SessionUser } from "@/server/guards";

export async function Dashboard({ base, user, locale }: { base: "/admin" | "/manager"; user: SessionUser; locale: string }) {
  const [t, ts, stats, moves] = await Promise.all([getTranslations("Back"), getTranslations("Status"), dashboardStats(), todayMovements()]);
  const kpis = [
    { label: t("kpiPending"), value: stats.pending, href: `${base}/reservations`, accent: stats.pending > 0 },
    { label: t("kpiOnRoad"), value: stats.on_road, href: `${base}/reservations` },
    { label: t("kpiActiveCars"), value: stats.active_cars, href: `${base}/fleet` },
    base === "/admin"
      ? { label: t("kpiActiveManagers"), value: stats.active_managers, href: "/admin/managers" }
      : null,
    { label: t("kpiRevenue"), value: formatMoney(stats.revenue, locale), href: `${base}/reservations` },
  ].filter(Boolean) as { label: string; value: string | number; href: string; accent?: boolean }[];

  const movement = (title: string, Icon: typeof ArrowUpFromLine, rows: typeof moves.departures) => (
    <Panel className="p-5">
      <h2 className="mb-4 flex items-center gap-2 font-bold text-ink"><Icon className="size-4 text-majorelle" />{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-3">{t("nothingToday")}</p>
      ) : (
        <ul className="divide-y divide-mist">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`${base}/reservations/${r.id}`} className="flex items-center gap-3 py-2.5 hover:text-majorelle">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{r.car}</span>
                  <span className="text-xs text-ink-3">{r.driver}, {r.city}</span>
                </span>
                <Badge tone={reservationTone[r.status]}>{ts(r.status)}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );

  return (
    <>
      <PageHeader title={t("dashboard")} subtitle={`${t("signedInAs")} ${user.name ?? user.email}`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className={`rounded-2xl border p-5 transition-colors hover:border-mist-2 ${k.accent ? "border-saffron/60 bg-saffron/10" : "border-mist bg-paper"}`}>
            <p className="text-xs font-medium text-ink-3">{k.label}</p>
            <p className="mt-2 text-[clamp(1.4rem,2.1vw,1.875rem)] leading-tight font-extrabold break-words text-ink tabular" style={{ fontStretch: "112%" }}>{k.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-ink">{t("latestRequests")}</h2>
            <Link href={`${base}/reservations`} className="text-sm font-semibold text-majorelle hover:underline">{t("openAll")}</Link>
          </div>
          {moves.pending.length === 0 ? (
            <p className="text-sm text-ink-3">{t("noRequests")}</p>
          ) : (
            <ul className="divide-y divide-mist">
              {moves.pending.map((r) => (
                <li key={r.id}>
                  <Link href={`${base}/reservations/${r.id}`} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{r.car}</span>
                      <span className="text-xs text-ink-3">{r.driver}, {formatDate(r.startDate, locale)} – {formatDate(r.endDate, locale)}</span>
                    </span>
                    <span className="text-sm font-bold text-ink tabular">{formatMoney(r.totalPrice, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {movement(t("todayDepartures"), ArrowUpFromLine, moves.departures)}
        {movement(t("todayReturns"), ArrowDownToLine, moves.returns)}
      </div>
    </>
  );
}
