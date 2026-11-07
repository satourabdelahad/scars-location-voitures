import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { carInspections, clientProfiles } from "@/db/schema";
import { fillContract, type ContractVariable } from "@/lib/contract";
import { formatDate, formatMoney } from "@/lib/utils";
import { extraName } from "@/lib/pricing";
import { getContractSettings } from "@/server/app-settings";
import { getReservationForStaff } from "@/server/queries/reservations";
import { getSiteSettings } from "@/server/site-settings";
import { documentViewUrl } from "@/server/uploads";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Contrat d'une réservation : en-tête et corps du modèle, variables remplacées avec les données réelles. */
export async function renderContract(reservationId: string, locale: string) {
  const r = await getReservationForStaff(reservationId);
  if (!r) return null;
  const [settings, site, profile, inspections, e] = await Promise.all([
    getContractSettings(),
    getSiteSettings(),
    db.query.clientProfiles.findFirst({ where: eq(clientProfiles.userId, r.clientId) }),
    db.select().from(carInspections).where(and(eq(carInspections.reservationId, r.id))).orderBy(desc(carInspections.createdAt)),
    getTranslations({ locale, namespace: "Enums" }),
  ]);
  const tx = await getTranslations({ locale, namespace: "Extras" });
  const tb = await getTranslations({ locale, namespace: "Booking" });
  const withTime = (d: string, t: string | null) => `${formatDate(d, locale)}${t ? ` ${t.slice(0, 5)}` : ""}`;
  const dep = inspections.find((i) => i.kind === "departure");
  const ret = inspections.find((i) => i.kind === "return");
  const money = (n: number) => formatMoney(n, locale);
  const civ = profile?.civility ? e(`civility.${profile.civility}`) : "";
  const sig = dep?.signaturePublicId ? documentViewUrl(dep.signaturePublicId, "image", "png") : null;
  const v: Partial<Record<ContractVariable, string>> = {
    company_address: site.contact.address,
    company_phone: site.contact.phone,
    company_email: site.contact.email,
    company_whatsapp: site.contact.whatsapp,
    agency_name: r.pickupAgency.name,
    agency_address: r.pickupAgency.address,
    agency_phone: r.pickupAgency.phone ?? "",
    client_civility: civ,
    client_last_name: profile?.lastName ?? r.driverLastName,
    client_first_name: profile?.firstName ?? r.driverFirstName,
    client_full_name: `${r.driverFirstName} ${r.driverLastName}`,
    client_phone: r.driverPhone || r.client.phone || "",
    client_email: r.client.email ?? "",
    client_city: profile?.city ?? "",
    client_birth_date: r.driverBirthDate ? formatDate(r.driverBirthDate, locale) : profile?.birthDate ? formatDate(profile.birthDate, locale) : "",
    client_license_number: r.driverLicenseNumber ?? profile?.licenseNumber ?? "",
    client_license_expires_on: r.driverLicenseExpiresOn ? formatDate(r.driverLicenseExpiresOn, locale) : profile?.licenseExpiresOn ? formatDate(profile.licenseExpiresOn, locale) : "",
    car_brand: r.car.brand,
    car_model: r.car.model,
    car_year: String(r.car.year),
    car_plate: r.car.plateNumber,
    car_color: r.car.colorName,
    car_vin: r.car.vin ?? "",
    car_fuel: e(`fuel.${r.car.fuel}`),
    car_transmission: e(`transmission.${r.car.transmission}`),
    car_category: e(`category.${r.car.category}`),
    reservation_reference: r.reference,
    start_date: withTime(r.startDate, r.pickupTime),
    end_date: withTime(r.endDate, r.returnTime),
    days: String(r.days),
    pickup_agency: `${r.pickupAgency.name}, ${r.pickupAgency.city}`,
    return_agency: `${r.returnAgency.name}, ${r.returnAgency.city}`,
    daily_price: money(r.dailyPrice),
    extras: [...(r.withDriver ? [tb("driverService")] : []), ...r.extras.map((x) => extraName(x.extra, tx))].join(", ") || "—",
    extras_total: money(r.extrasTotal + (r.driverTotal ?? 0)),
    discount: money(r.discountAmount),
    total_price: money(r.totalPrice),
    deposit: money(r.deposit),
    departure_mileage: dep ? `${dep.mileage.toLocaleString(locale)} km` : "",
    departure_fuel: dep ? `${dep.fuelEighths}/8` : "",
    departure_damages: dep?.damages ?? (dep ? "—" : ""),
    return_mileage: ret ? `${ret.mileage.toLocaleString(locale)} km` : "",
    return_fuel: ret ? `${ret.fuelEighths}/8` : "",
    return_damages: ret?.damages ?? (ret ? "—" : ""),
    client_signature_img: sig ? `<img src="${esc(sig)}" alt="" style="height:70px">` : "",
    today: formatDate(new Date(), locale),
    company_logo_img: settings.logoUrl ? `<img src="${esc(settings.logoUrl)}" alt="" style="max-height:64px">` : "",
  };
  return { reference: r.reference, header: fillContract(settings.headerHtml, v), body: fillContract(settings.bodyHtml, v) };
}
