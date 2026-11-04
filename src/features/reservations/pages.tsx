import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { tablePreferences } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { CarArt } from "@/components/car-art";
import { Badge, DefinitionList, PageHeader, Panel, reservationTone } from "@/components/ui/misc";
import { getReservationForStaff, listReservationsForStaff } from "@/server/queries/reservations";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { promotionLabel } from "@/lib/promotion-label";
import { ReservationsTable } from "./reservations-table";
import { ReservationActions } from "./reservation-actions";

type Base = "/admin" | "/manager";

export async function ReservationsListPage({ base, userId }: { base: Base; userId: string }) {
  const t = await getTranslations("Reservations");
  const [rows, [prefs]] = await Promise.all([
    listReservationsForStaff(),
    db.select().from(tablePreferences).where(and(eq(tablePreferences.userId, userId), eq(tablePreferences.tableKey, "reservations"))),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ReservationsTable rows={rows} base={base} prefs={prefs ? { visibleColumns: prefs.visibleColumns, pageSize: prefs.pageSize } : null} />
    </>
  );
}

export async function ReservationDetailPage({ base, id, locale }: { base: Base; id: string; locale: string }) {
  const r = await getReservationForStaff(id);
  if (!r) notFound();
  const [t, ts, tb, tx, te, tf] = await Promise.all([
    getTranslations("Reservations"),
    getTranslations("Status"),
    getTranslations("Booking"),
    getTranslations("Extras"),
    getTranslations("Errors"),
    getTranslations("Fleet"),
  ]);
  const timeline = [
    { label: t("createdAt"), at: r.createdAt },
    { label: ts("confirmed"), at: r.confirmedAt },
    { label: t("markPickedUp"), at: r.pickedUpAt },
    { label: t("markReturned"), at: r.returnedAt },
    { label: r.status === "rejected" ? ts("rejected") : ts("cancelled"), at: r.cancelledAt },
  ].filter((x) => x.at);

  return (
    <>
      <Link href={`${base}/reservations`} className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
      <PageHeader
        title={<span dir="ltr" className="font-mono">{r.reference}</span>}
        subtitle={<Badge tone={reservationTone[r.status]} dot>{ts(r.status)}</Badge>}
      />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Panel className="grid gap-6 p-6 sm:grid-cols-[200px_1fr]">
            <div className="rounded-xl bg-gradient-to-b from-chalk to-mist/60 px-3 pt-2">
              <CarArt category={r.car.category} color={r.car.colorHex} className="w-full" />
            </div>
            <DefinitionList
              items={[
                { label: t("car"), value: <Link href={`${base}/fleet/${r.car.id}`} className="hover:text-majorelle">{r.car.brand} {r.car.model}</Link> },
                { label: tf("plateNumber"), value: <span dir="ltr" className="font-mono text-sm">{r.car.plateNumber}</span> },
                { label: t("period"), value: `${formatDate(r.startDate, locale)} – ${formatDate(r.endDate, locale)}` },
                { label: tb("rental"), value: `${r.days} × ${formatMoney(r.dailyPrice, locale)}` },
                { label: tb("pickupAgency"), value: `${r.pickupAgency.city}, ${r.pickupAgency.name}` },
                { label: tb("returnAgency"), value: `${r.returnAgency.city}, ${r.returnAgency.name}` },
              ]}
            />
          </Panel>
          <Panel className="p-6">
            <h2 className="mb-5 font-bold text-ink">{t("driver")}</h2>
            <DefinitionList
              items={[
                { label: tb("driverFirstName"), value: `${r.driverFirstName} ${r.driverLastName}` },
                { label: tb("driverPhone"), value: <a href={`tel:${r.driverPhone}`} dir="ltr" className="hover:text-majorelle">{r.driverPhone}</a> },
                { label: t("license"), value: <span dir="ltr">{r.driverLicenseNumber}</span> },
                { label: tb("driverBirthDate"), value: formatDate(r.driverBirthDate, locale) },
                { label: t("flight"), value: r.flightNumber ?? "—" },
                { label: t("client"), value: r.client.email ?? r.client.name ?? "—" },
              ]}
            />
            {r.clientNote && (
              <div className="mt-5 rounded-xl bg-chalk p-4">
                <p className="text-xs font-semibold text-ink-3">{t("clientNote")}</p>
                <p className="mt-1 text-sm text-ink-2">{r.clientNote}</p>
              </div>
            )}
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel className="p-6">
            <dl className="space-y-2.5 text-sm tabular">
              <div className="flex justify-between"><dt className="text-ink-2">{tb("rental")}</dt><dd className="font-semibold text-ink">{formatMoney(r.dailyPrice * r.days, locale)}</dd></div>
              {r.extras.map((x) => (
                <div key={x.extraId} className="flex justify-between"><dt className="text-ink-2">{tx(x.extra.code as "gps")}</dt><dd className="font-semibold text-ink">{formatMoney(x.unitPricePerDay * r.days, locale)}</dd></div>
              ))}
              {r.discountAmount > 0 && (
                <div className="flex justify-between text-palm"><dt>{tb("discount")}{r.promotion ? <span dir="ltr"> ({promotionLabel(r.promotion)})</span> : null}</dt><dd className="font-semibold">−{formatMoney(r.discountAmount, locale)}</dd></div>
              )}
              <div className="flex items-baseline justify-between border-t border-mist pt-3">
                <dt className="font-bold text-ink">{tb("total")}</dt>
                <dd className="text-2xl font-extrabold text-ink" style={{ fontStretch: "112%" }}>{formatMoney(r.totalPrice, locale)}</dd>
              </div>
            </dl>
            <div className="mt-6">
              <ReservationActions id={r.id} status={r.status} internalNote={r.internalNote} />
            </div>
          </Panel>
          <Panel className="p-6">
            <h2 className="mb-4 font-bold text-ink">{t("timeline")}</h2>
            <ol className="space-y-3 border-s border-mist-2 ps-5">
              {timeline.map((x) => (
                <li key={x.label} className="relative">
                  <span className="absolute -start-[25px] top-1.5 size-2.5 rounded-full bg-majorelle ring-4 ring-paper" aria-hidden />
                  <p className="text-sm font-semibold text-ink">{x.label}</p>
                  <p className="text-xs text-ink-3">{formatDateTime(x.at, locale)}</p>
                </li>
              ))}
            </ol>
            {r.handler && <p className="mt-4 text-sm text-ink-3">{t("handledBy")} : <span className="font-semibold text-ink">{r.handler.name ?? r.handler.email}</span></p>}
            {r.cancelReason && <p className="mt-2 text-sm text-danger">{r.cancelReason === "car_unavailable" ? te("car_unavailable") : r.cancelReason}</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}
