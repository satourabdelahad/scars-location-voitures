import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { auth, socialProviders } from "@/auth";
import { db } from "@/db";
import { clientProfiles, extras, users } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { CarArt } from "@/components/car-art";
import { getBookedRanges, getPublicCar, listAgencies } from "@/server/queries/cars";
import { assignedPromotions } from "@/server/promotions";
import { BookingForm } from "./booking-form";
import { SocialButtons } from "../../(auth)/social-buttons";
import { todayISO } from "@/lib/utils";
import { PROMO_COOKIE } from "@/lib/promo-cookie";

export default async function BookPage({ params, searchParams }: PageProps<"/[locale]/book/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const car = await getPublicCar(id, locale);
  if (!car) notFound();
  const session = await auth();
  const t = await getTranslations("Booking");

  const start = typeof sp.start === "string" && sp.start >= todayISO() ? sp.start : todayISO(2);
  const end = typeof sp.end === "string" && sp.end > start ? sp.end : todayISO(5);
  const callback = `/${locale}/book/${car.id}?start=${start}&end=${end}`;

  // L'équipe (administrateur, gestionnaires) ne réserve pas avec son compte depuis le site public.
  if (session?.user && session.user.role !== "client") {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
        <CarArt category={car.category} color={car.colorHex} className="w-72" />
        <h1 className="display-md mt-6 text-3xl text-ink">{t("title", { car: `${car.brand} ${car.model}` })}</h1>
        <p className="mt-4 text-ink-2">{t("staffCannotBook")}</p>
      </div>
    );
  }

  const client = session?.user?.role === "client" ? session.user : null;
  const [agencyRows, extraRows, booked, profile, promos] = await Promise.all([
    listAgencies(),
    db.select().from(extras).where(eq(extras.isActive, true)),
    getBookedRanges(car.id),
    client
      ? db
          .select({ first: clientProfiles.firstName, last: clientProfiles.lastName, phone: users.phone, name: users.name })
          .from(users)
          .leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
          .where(eq(users.id, client.id))
          .limit(1)
          .then((r) => r[0])
      : null,
    client ? assignedPromotions(client.id) : [],
  ]);
  const [first, ...rest] = (profile?.name ?? client?.name ?? "").split(" ");
  // Code reçu par email (campagne) : appliqué automatiquement.
  const cookieCode = (await cookies()).get(PROMO_COOKIE)?.value;
  const suggestedPromo = (typeof sp.promo === "string" ? sp.promo : undefined) ?? promos[0]?.code ?? cookieCode;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="display-md text-3xl text-ink sm:text-4xl">{t("title", { car: `${car.brand} ${car.model}` })}</h1>
      <BookingForm
        car={{
          id: car.id,
          name: `${car.brand} ${car.model}`,
          category: car.category,
          colorHex: car.colorHex,
          dailyPrice: car.dailyPrice,
          promoPercent: car.promoPercent,
          promoStartsOn: car.promoStartsOn,
          promoEndsOn: car.promoEndsOn,
          deposit: car.deposit,
          agencyId: car.agencyId,
          cover: car.images[0]?.url ?? null,
        }}
        agencies={agencyRows.map((a) => ({ id: a.id, label: `${a.city} : ${a.name}` }))}
        extras={extraRows.map((x) => ({ id: x.id, code: x.code, pricePerDay: x.pricePerDay }))}
        booked={booked}
        defaults={{
          startDate: start,
          endDate: end,
          driverFirstName: profile?.first ?? first ?? "",
          driverLastName: profile?.last ?? rest.join(" "),
          driverPhone: profile?.phone ?? "",
        }}
        suggestedPromo={suggestedPromo}
        guest={!client}
        identify={
          client ? undefined : (
            <>
              <SocialButtons enabled={socialProviders} callbackUrl={callback} />
              <p className="mt-4 text-sm text-ink-2">
                {t("haveAccount")}{" "}
                <Link href={`/login?callbackUrl=${encodeURIComponent(callback)}`} className="font-semibold text-majorelle hover:underline">
                  {t("loginWithPassword")}
                </Link>
              </p>
            </>
          )
        }
        locale={locale}
      />
    </div>
  );
}
