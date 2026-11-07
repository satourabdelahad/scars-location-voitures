import { desc, eq } from "drizzle-orm";
import { CalendarDays, ChevronRight, History, IdCard, MapPin } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/db";
import { reservations, users } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { CarArt } from "@/components/car-art";
import { Badge, EmptyState, reservationTone } from "@/components/ui/misc";
import { requireRole } from "@/server/guards";
import { cn, formatDate, formatDateTime, formatMoney, initials, todayISO } from "@/lib/utils";
import { clientHistory } from "@/server/queries/client-space";
import { SelfProfilePage } from "@/features/profile/self-profile-page";

type Tab = "infos" | "reservations" | "history";

/** Espace client, comme la fiche d'un gestionnaire : Informations, Réservations (toutes ses locations) et Historique. */
export default async function AccountPage({ params, searchParams }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const tab: Tab = sp.tab === "infos" || sp.tab === "history" ? sp.tab : "reservations";
  const user = await requireRole(["client"], "/account");
  const [t, ts, [me]] = await Promise.all([
    getTranslations("Account"),
    getTranslations("Status"),
    db.select({ name: users.name, email: users.email, phone: users.phone, image: users.image }).from(users).where(eq(users.id, user.id)).limit(1),
  ]);
  const tabs: { id: Tab; label: string; Icon: typeof IdCard }[] = [
    { id: "infos", label: t("tabInfos"), Icon: IdCard },
    { id: "reservations", label: t("tabReservations"), Icon: CalendarDays },
    { id: "history", label: t("tabHistory"), Icon: History },
  ];

  let body: React.ReactNode;
  if (tab === "infos") {
    body = <SelfProfilePage me={user} welcome={sp.welcome === "1"} header={false} />;
  } else if (tab === "history") {
    const events = await clientHistory(user.id);
    body = events.length ? (
      <ol className="space-y-3 border-s border-mist-2 ps-6">
        {events.map((ev, i) => (
          <li key={i} className="relative">
            <span className="absolute -start-[29px] top-1.5 size-2.5 rounded-full bg-majorelle ring-4 ring-chalk" aria-hidden />
            <p className="text-sm font-semibold text-ink">
              {t(`ev.${ev.kind}` as "ev.booked", { detail: ev.kind === "document" && ev.detail ? t(`doc.${ev.detail}` as "doc.id_front") : (ev.detail ?? "") })}
              {ev.reference && ev.reservationId && (
                <Link href={`/account/reservations/${ev.reservationId}`} className="ms-2 font-mono text-xs text-majorelle hover:underline" dir="ltr">{ev.reference}</Link>
              )}
            </p>
            <p className="text-xs text-ink-3">{formatDateTime(ev.at, locale)}</p>
          </li>
        ))}
      </ol>
    ) : (
      <div className="rounded-[22px] border border-dashed border-mist-2"><EmptyState icon={<History />} title={t("historyEmpty")} /></div>
    );
  } else {
    const rows = await db.query.reservations.findMany({
      where: eq(reservations.clientId, user.id),
      orderBy: [desc(reservations.startDate)],
      with: { car: true, pickupAgency: true },
    });
    const today = todayISO();
    body = rows.length ? (
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/account/reservations/${r.id}`} className="grid gap-5 rounded-[22px] border border-mist bg-paper p-5 transition-colors hover:border-mist-2 sm:grid-cols-[150px_1fr_auto] sm:items-center">
              <div className="rounded-xl bg-gradient-to-b from-chalk to-mist/60 px-3 pt-2">
                <CarArt category={r.car.category} color={r.car.colorHex} className="w-full" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-bold text-ink">{r.car.brand} {r.car.model}</p>
                  <Badge tone={reservationTone[r.status]} dot>{ts(r.status)}</Badge>
                  {r.endDate >= today && ["pending", "confirmed", "ongoing"].includes(r.status) && <Badge tone="info">{t("upcomingBadge")}</Badge>}
                </div>
                <p className="mt-1 font-mono text-xs text-ink-3" dir="ltr">{r.reference}</p>
                <ul className="mt-2 space-y-1 text-sm text-ink-2">
                  <li className="flex items-center gap-2"><CalendarDays className="size-4 text-ink-3" />{formatDate(r.startDate, locale)}{r.pickupTime ? ` ${r.pickupTime.slice(0, 5)}` : ""} – {formatDate(r.endDate, locale)}{r.returnTime ? ` ${r.returnTime.slice(0, 5)}` : ""}</li>
                  <li className="flex items-center gap-2"><MapPin className="size-4 text-ink-3" />{r.pickupAgency.city}, {r.pickupAgency.name}</li>
                </ul>
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                <p className="text-xl font-extrabold text-ink tabular" style={{ fontStretch: "112%" }}>{formatMoney(r.totalPrice, locale)}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-majorelle">{t("seeDetails")}<ChevronRight className="size-4 rtl:rotate-180" /></span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <div className="rounded-[22px] border border-dashed border-mist-2">
        <EmptyState icon={<CalendarDays />} title={t("emptyTitle")} body={t("emptyBody")} action={<Link href="/reservation" className="rounded-xl bg-majorelle px-5 py-3 font-semibold text-white">{t("browse")}</Link>} />
      </div>
    );
  }

  const name = me?.name || me?.email || "—";
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-4">
        {me?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.image} alt="" className="size-16 rounded-2xl object-cover" />
        ) : (
          <span className="grid size-16 place-items-center rounded-2xl bg-majorelle-soft text-xl font-extrabold text-majorelle">{initials(name)}</span>
        )}
        <div className="min-w-0">
          <h1 className="display-md truncate text-3xl text-ink sm:text-4xl">{name}</h1>
          <p className="mt-1 text-sm text-ink-3" dir="ltr">{[me?.email, me?.phone].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <nav aria-label={t("title")} className="scroll-thin my-6 flex gap-1 overflow-x-auto border-b border-mist">
        {tabs.map(({ id, label, Icon }) => (
          <Link
            key={id}
            href={`/account?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cn("-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors", tab === id ? "border-majorelle text-majorelle" : "border-transparent text-ink-3 hover:text-ink")}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      {body}
    </div>
  );
}
