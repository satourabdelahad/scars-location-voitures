import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { extras } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { CarArt } from "@/components/car-art";
import { getBookedRanges, getPublicCar, listAgencies } from "@/server/queries/cars";
import { BookingForm } from "./booking-form";
import { todayISO } from "@/lib/utils";

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

  if (!session?.user || session.user.role !== "client") {
    const callback = `/${locale}/book/${car.id}?start=${start}&end=${end}`;
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
        <CarArt category={car.category} color={car.colorHex} className="w-72" />
        <h1 className="display-md mt-6 text-3xl text-ink">{t("title", { car: `${car.brand} ${car.model}` })}</h1>
        <Link href={`/login?callbackUrl=${encodeURIComponent(callback)}`} className="mt-8 rounded-xl bg-majorelle px-6 py-3.5 font-bold text-white hover:bg-majorelle-deep">
          {t("loginToBook")}
        </Link>
      </div>
    );
  }

  const [agencyRows, extraRows, booked] = await Promise.all([
    listAgencies(),
    db.select().from(extras).where(eq(extras.isActive, true)),
    getBookedRanges(car.id),
  ]);
  const [first, ...rest] = (session.user.name ?? "").split(" ");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="display-md text-3xl text-ink sm:text-4xl">{t("title", { car: `${car.brand} ${car.model}` })}</h1>
      <BookingForm
        car={{ id: car.id, name: `${car.brand} ${car.model}`, category: car.category, colorHex: car.colorHex, dailyPrice: car.dailyPrice, deposit: car.deposit, agencyId: car.agencyId, cover: car.images[0]?.url ?? null }}
        agencies={agencyRows.map((a) => ({ id: a.id, label: `${a.city} : ${a.name}` }))}
        extras={extraRows.map((x) => ({ id: x.id, code: x.code, pricePerDay: x.pricePerDay }))}
        booked={booked}
        defaults={{ startDate: start, endDate: end, driverFirstName: first ?? "", driverLastName: rest.join(" ") }}
        locale={locale}
      />
    </div>
  );
}
