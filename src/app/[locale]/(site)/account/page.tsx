import { desc, eq } from "drizzle-orm";
import { CalendarDays, MapPin } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/db";
import { reservations } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { CarArt } from "@/components/car-art";
import { Badge, EmptyState, reservationTone } from "@/components/ui/misc";
import { requireRole } from "@/server/guards";
import { formatDate, formatMoney, todayISO } from "@/lib/utils";
import { CancelReservationButton } from "./cancel-button";

export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(["client"], "/account");
  const [t, ts, e, te] = await Promise.all([getTranslations("Account"), getTranslations("Status"), getTranslations("Extras"), getTranslations("Errors")]);

  const rows = await db.query.reservations.findMany({
    where: eq(reservations.clientId, user.id),
    orderBy: [desc(reservations.startDate)],
    with: { car: true, pickupAgency: true, returnAgency: true, extras: { with: { extra: true } } },
  });
  const today = todayISO();
  const upcoming = rows.filter((r) => r.endDate >= today && !["cancelled", "rejected", "completed"].includes(r.status));
  const past = rows.filter((r) => !upcoming.includes(r));

  const card = (r: (typeof rows)[number]) => (
    <div className="grid gap-5 rounded-[22px] border border-mist bg-paper p-5 sm:grid-cols-[180px_1fr_auto] sm:items-center">
      <div className="rounded-xl bg-gradient-to-b from-chalk to-mist/60 px-3 pt-2">
        <CarArt category={r.car.category} color={r.car.colorHex} className="w-full" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-bold text-ink">{r.car.brand} {r.car.model}</p>
          <Badge tone={reservationTone[r.status]} dot>{ts(r.status)}</Badge>
        </div>
        <p className="mt-1 font-mono text-xs text-ink-3" dir="ltr">{r.reference}</p>
        <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
          <li className="flex items-center gap-2"><CalendarDays className="size-4 text-ink-3" />{formatDate(r.startDate, locale)} – {formatDate(r.endDate, locale)}</li>
          <li className="flex items-center gap-2"><MapPin className="size-4 text-ink-3" />{r.pickupAgency.city}, {r.pickupAgency.name}</li>
        </ul>
        {r.extras.length > 0 && <p className="mt-2 text-xs text-ink-3">{r.extras.map((x) => e(x.extra.code as "gps")).join(", ")}</p>}
        {r.cancelReason && <p className="mt-2 text-xs text-danger">{r.cancelReason === "car_unavailable" ? te("car_unavailable") : r.cancelReason}</p>}
      </div>
      <div className="flex flex-col items-start gap-3 sm:items-end">
        <p className="text-xl font-extrabold text-ink tabular" style={{ fontStretch: "112%" }}>{formatMoney(r.totalPrice, locale)}</p>
        {["pending", "confirmed"].includes(r.status) && r.startDate > today && <CancelReservationButton id={r.id} />}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="display-md text-4xl text-ink">{t("title")}</h1>
      <p className="mt-2 text-ink-3">{t("subtitle")}</p>
      {rows.length === 0 ? (
        <div className="mt-8 rounded-[22px] border border-dashed border-mist-2">
          <EmptyState icon={<CalendarDays />} title={t("emptyTitle")} body={t("emptyBody")} action={<Link href="/cars" className="rounded-xl bg-majorelle px-5 py-3 font-semibold text-white">{t("browse")}</Link>} />
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-4 text-lg font-bold text-ink">{t("upcoming")}</h2>
              <ul className="space-y-3">{upcoming.map((r) => <li key={r.id} className="contents">{card(r)}</li>)}</ul>
            </section>
          )}
          {past.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-lg font-bold text-ink">{t("past")}</h2>
              <ul className="space-y-3 opacity-90">{past.map((r) => <li key={r.id} className="contents">{card(r)}</li>)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
