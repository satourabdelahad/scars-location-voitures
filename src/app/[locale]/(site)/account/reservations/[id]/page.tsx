import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/db";
import { reservationExtensions, reservations } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { CarArt } from "@/components/car-art";
import { Badge, reservationTone } from "@/components/ui/misc";
import { requireRole } from "@/server/guards";
import { extraCost } from "@/lib/pricing";
import { formatDate, formatDateTime, formatMoney, todayISO } from "@/lib/utils";
import { getBookingSettings } from "@/server/app-settings";
import { latestClientDocuments } from "@/server/queries/client-documents";
import { RecapActions, ClientDocuments } from "@/features/account/recap-actions";

/** Récapitulatif d'une réservation côté client : détails, impression ou PDF, annulation, prolongation, pièces. */
export default async function ClientReservationPage({ params, searchParams }: PageProps<"/[locale]/account/reservations/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const user = await requireRole(["client"], `/account/reservations/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await db.query.reservations.findFirst({
    where: and(eq(reservations.id, id), eq(reservations.clientId, user.id)),
    with: { car: true, pickupAgency: true, returnAgency: true, extras: { with: { extra: true } }, promotion: true },
  });
  if (!r) notFound();
  const [t, tb, ts, tx, e, booking, extensions, docs] = await Promise.all([
    getTranslations("Account"),
    getTranslations("Booking"),
    getTranslations("Status"),
    getTranslations("Extras"),
    getTranslations("Enums"),
    getBookingSettings(),
    db.select().from(reservationExtensions).where(eq(reservationExtensions.reservationId, r.id)).orderBy(desc(reservationExtensions.createdAt)),
    latestClientDocuments(user.id),
  ]);
  const time = (x: string | null) => (x ? ` · ${x.slice(0, 5)}` : "");
  const pendingExt = extensions.find((x) => x.status === "pending");
  const extraLabel = (x: (typeof r.extras)[number]) => x.extra.name ?? (tx.has(x.extra.code as "gps") ? tx(x.extra.code as "gps") : x.extra.code);
  const rows: [string, string][] = [
    [tb("rental"), `${r.days} × ${formatMoney(r.dailyPrice, locale)} = ${formatMoney(r.dailyPrice * r.days, locale)}`],
    ...(r.withDriver ? [[tb("driverLine"), r.driverTotal > 0 ? formatMoney(r.driverTotal, locale) : tb("onQuote")] as [string, string]] : []),
    ...r.extras.map((x) => [extraLabel(x), formatMoney(extraCost({ price: x.unitPricePerDay, pricing: x.pricing, qty: x.quantity }, r.days), locale)] as [string, string]),
    ...(r.discountAmount > 0 ? [[`${tb("discount")}${r.promotion ? ` (${r.promotion.code})` : ""}`, `−${formatMoney(r.discountAmount, locale)}`] as [string, string]] : []),
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <style>{`@media print{header,footer,nav,.no-print,[data-topbar]{display:none!important}body{background:#fff!important}#recap{border:0!important;box-shadow:none!important}}`}</style>
      <Link href="/account?tab=reservations" className="no-print inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("tabReservations")}
      </Link>

      {sp.new === "1" && (
        <div className="no-print mt-4 flex items-start gap-3 rounded-2xl border border-palm/30 bg-palm-soft px-5 py-4 text-sm text-ink" role="status">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-palm" />
          <div>
            <p className="font-bold text-palm">{tb("receivedTitle")}</p>
            <p className="mt-1 text-ink-2">{tb("receivedBody", { ref: r.reference, hours: booking.responseHours })}</p>
          </div>
        </div>
      )}
      {pendingExt && (
        <div className="no-print mt-4 flex items-start gap-3 rounded-2xl border border-saffron/50 bg-saffron/10 px-5 py-4 text-sm text-ink">
          <Clock className="mt-0.5 size-5 shrink-0 text-saffron-ink" />
          <p>{t("extensionPending", { date: formatDate(pendingExt.requestedEndDate, locale), hours: booking.responseHours })}</p>
        </div>
      )}

      <article id="recap" className="mt-5 overflow-hidden rounded-[22px] border border-mist bg-paper">
        <div className="grid gap-5 p-6 sm:grid-cols-[200px_1fr]">
          <div className="rounded-xl bg-gradient-to-b from-chalk to-mist/60 px-3 pt-2">
            <CarArt category={r.car.category} color={r.car.colorHex} className="w-full" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-ink">{r.car.brand} {r.car.model}</h1>
              <Badge tone={reservationTone[r.status]} dot>{ts(r.status)}</Badge>
            </div>
            <p className="mt-1 font-mono text-sm text-ink-3" dir="ltr">{r.reference}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-semibold text-ink-3">{tb("pickupAgency")}</dt><dd className="font-semibold text-ink">{r.pickupAgency.city}, {r.pickupAgency.name}</dd><dd className="text-xs text-ink-3">{r.pickupAgency.address}</dd></div>
              <div><dt className="text-xs font-semibold text-ink-3">{tb("returnAgency")}</dt><dd className="font-semibold text-ink">{r.returnAgency.city}, {r.returnAgency.name}</dd><dd className="text-xs text-ink-3">{r.returnAgency.address}</dd></div>
              <div><dt className="text-xs font-semibold text-ink-3">{tb("startDate")}</dt><dd className="font-semibold text-ink">{formatDate(r.startDate, locale)}{time(r.pickupTime)}</dd></div>
              <div><dt className="text-xs font-semibold text-ink-3">{tb("endDate")}</dt><dd className="font-semibold text-ink">{formatDate(r.endDate, locale)}{time(r.returnTime)}</dd></div>
              <div><dt className="text-xs font-semibold text-ink-3">{tb("needDriver")}</dt><dd className="font-semibold text-ink">{r.withDriver ? tb("yesDriver") : tb("noDriver")}</dd></div>
              <div><dt className="text-xs font-semibold text-ink-3">{t("carSpecs")}</dt><dd className="font-semibold text-ink">{e(`transmission.${r.car.transmission}`)} · {e(`fuel.${r.car.fuel}`)} · {r.car.plateNumber}</dd></div>
            </dl>
          </div>
        </div>
        <div className="border-t border-mist p-6">
          <dl className="space-y-2 text-sm tabular">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-ink-2">{k}</dt><dd className="font-semibold text-ink">{v}</dd></div>
            ))}
            <div className="flex items-baseline justify-between border-t border-mist pt-3">
              <dt className="font-bold text-ink">{tb("totalSum")}</dt>
              <dd className="text-2xl font-extrabold text-ink" style={{ fontStretch: "112%" }}>{formatMoney(r.totalPrice, locale)}</dd>
            </div>
            <div className="flex justify-between"><dt className="text-ink-2">{tb("depositLabel")}</dt><dd className="font-semibold text-ink">{formatMoney(r.deposit, locale)}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-ink-3">{t("bookedOn", { date: formatDateTime(r.createdAt, locale) })}</p>
        </div>
      </article>

      <div className="no-print">
        <RecapActions
          id={r.id}
          reference={r.reference}
          canCancel={["pending", "confirmed"].includes(r.status) && r.startDate > todayISO()}
          canExtend={["pending", "confirmed", "ongoing"].includes(r.status) && !pendingExt}
          endDate={r.endDate}
        />
        {extensions.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold text-ink">{t("extensionsTitle")}</h2>
            <ul className="space-y-2">
              {extensions.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-mist bg-paper px-4 py-3 text-sm">
                  <Badge tone={x.status === "accepted" ? "success" : x.status === "refused" ? "danger" : "warning"}>{t(`ext.${x.status}`)}</Badge>
                  <span className="text-ink-2">{formatDate(x.fromEndDate, locale)} → <span className="font-semibold text-ink">{formatDate(x.requestedEndDate, locale)}</span></span>
                  {x.reason && <span className="text-ink-3">{x.reason}</span>}
                  <span className="ms-auto text-xs text-ink-3">{formatDateTime(x.createdAt, locale)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <ClientDocuments reservationId={r.id} docs={docs} />
      </div>
    </div>
  );
}
