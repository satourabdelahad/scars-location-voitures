import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asc, eq } from "drizzle-orm";
import { auth, socialProviders } from "@/auth";
import { db } from "@/db";
import { clientProfiles, extras, users } from "@/db/schema";
import { CarArt } from "@/components/car-art";
import { RichText } from "@/components/rich-text";
import { getBookedRanges, getPublicCar, listAgencies } from "@/server/queries/cars";
import { assignedPromotions } from "@/server/promotions";
import { getBookingSettings } from "@/server/app-settings";
import { getSiteSettings, pageText } from "@/server/site-settings";
import { defaultPageText } from "@/lib/site-page-defaults";
import { BookingForm } from "./booking-form";
import { todayISO } from "@/lib/utils";
import { PROMO_COOKIE } from "@/lib/promo-cookie";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
const isTime = (v?: string) => Boolean(v && /^\d{2}:\d{2}$/.test(v));

/**
 * Réserver une voiture : détails, lieu et dates, chauffeur, suppléments, caution et total, conditions de location ;
 * l'identification (réseaux sociaux, email et mot de passe, ou nouvelle fiche) n'est demandée qu'au clic sur Réserver.
 */
export default async function BookPage({ params, searchParams }: PageProps<"/[locale]/book/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const car = await getPublicCar(id, locale);
  if (!car) notFound();
  const session = await auth();
  const [t, tx, e] = await Promise.all([getTranslations("Booking"), getTranslations("Extras"), getTranslations("Enums")]);

  const startRaw = one(sp.start);
  const start = isDate(startRaw) && startRaw! >= todayISO() ? startRaw! : todayISO(1);
  const endRaw = one(sp.end);
  const end = isDate(endRaw) && endRaw! > start ? endRaw! : todayISO(4);

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
  const [agencyRows, extraRows, booked, profile, promos, booking, site] = await Promise.all([
    listAgencies(),
    db.select().from(extras).where(eq(extras.isActive, true)).orderBy(asc(extras.sortOrder), asc(extras.id)),
    getBookedRanges(car.id),
    client
      ? db
          .select({
            civility: clientProfiles.civility,
            first: clientProfiles.firstName,
            last: clientProfiles.lastName,
            city: clientProfiles.city,
            whatsapp: clientProfiles.whatsapp,
            idCard: clientProfiles.idCardNumber,
            license: clientProfiles.licenseNumber,
            phone: users.phone,
            name: users.name,
          })
          .from(users)
          .leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
          .where(eq(users.id, client.id))
          .limit(1)
          .then((r) => r[0])
      : null,
    client ? assignedPromotions(client.id) : [],
    getBookingSettings(),
    getSiteSettings(),
  ]);
  const [first, ...rest] = (profile?.name ?? client?.name ?? "").split(" ");
  // Code reçu par email (campagne) : appliqué automatiquement.
  const cookieCode = (await cookies()).get(PROMO_COOKIE)?.value;
  const suggestedPromo = one(sp.promo) ?? promos[0]?.code ?? cookieCode;
  const agencyParam = Number(one(sp.agency));
  const pickup = agencyRows.find((a) => a.id === agencyParam)?.id ?? car.agencyId;
  const chosenExtras = (one(sp.extras) ?? "").split(",").map(Number).filter((n) => extraRows.some((x) => x.id === n));
  const terms = pageText(site, "terms", locale) ?? defaultPageText("terms", locale);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="display-md text-3xl text-ink sm:text-4xl">{t("title", { car: `${car.brand} ${car.model}` })}</h1>
      <BookingForm
        car={{
          id: car.id,
          name: `${car.brand} ${car.model}`,
          year: car.year,
          category: car.category,
          categoryLabel: e(`category.${car.category}`),
          specs: [
            t("specSeats", { count: car.seats }),
            t("specDoors", { count: car.doors }),
            e(`transmission.${car.transmission}`),
            e(`fuel.${car.fuel}`),
            t("specBags", { count: car.luggage }),
            ...(car.airConditioning ? [t("specAc")] : []),
          ],
          colorHex: car.colorHex,
          dailyPrice: car.dailyPrice,
          promoPercent: car.promoPercent,
          promoStartsOn: car.promoStartsOn,
          promoEndsOn: car.promoEndsOn,
          deposit: car.deposit,
          images: car.images.map((i) => i.url),
          description: car.description,
        }}
        agencies={agencyRows.map((a) => ({ id: a.id, label: `${a.city} · ${a.name}`, address: a.address }))}
        extras={extraRows.map((x) => ({ id: x.id, name: x.name ?? (tx.has(x.code as "gps") ? tx(x.code as "gps") : x.code), price: x.pricePerDay, pricing: x.pricing }))}
        driverPricePerDay={booking.driverPricePerDay}
        booked={booked}
        initial={{
          startDate: start,
          endDate: end,
          pickupTime: isTime(one(sp.startTime)) ? one(sp.startTime)! : "",
          returnTime: isTime(one(sp.endTime)) ? one(sp.endTime)! : "",
          pickupAgencyId: pickup,
          returnAgencyId: pickup,
          extras: chosenExtras,
          withDriver: one(sp.driver) === "1",
          acceptTerms: one(sp.terms) === "1",
        }}
        profile={
          client
            ? {
                civility: profile?.civility ?? "",
                firstName: profile?.first ?? first ?? "",
                lastName: profile?.last ?? rest.join(" "),
                city: profile?.city ?? "",
                phone: profile?.phone ?? "",
                whatsapp: profile?.whatsapp ?? "",
                idCardNumber: profile?.idCard ?? "",
                licenseNumber: profile?.license ?? "",
              }
            : null
        }
        suggestedPromo={suggestedPromo}
        socialEnabled={socialProviders}
        terms={<RichText text={terms} />}
        locale={locale}
      />
    </div>
  );
}
