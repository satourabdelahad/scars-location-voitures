import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { db } from "@/db";
import { carManagers, managers, reservations, users } from "@/db/schema";
import { formatDate, formatMoney } from "@/lib/utils";
import { APP_BASE_URL, emailButton, sendTemplate } from "@/server/email";

/** Les modèles sont rédigés en français : les libellés (carrosserie, motorisation…) le sont aussi. */
async function fr() {
  const messages = (await import("../messages/fr.json")).default;
  return createTranslator({ locale: "fr", messages, namespace: "Enums" });
}
const fmtDate = (d: string) => formatDate(d, "fr");
const money = (n: number) => formatMoney(n, "fr");

type Staff = { email: string; name: string; role: "admin" | "manager" };

/** Administrateurs actifs + gestionnaires actifs associés à la voiture (tous s'il n'y en a aucun). */
async function staffFor(carId: string | null): Promise<{ staff: Staff[]; associated: string[] }> {
  const admins = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active")));
  const linked = carId
    ? await db.select({ id: carManagers.managerId }).from(carManagers).where(eq(carManagers.carId, carId))
    : [];
  const mgrs = await db
    .select({ email: users.email, first: managers.firstName, last: managers.lastName })
    .from(managers)
    .innerJoin(users, eq(users.id, managers.userId))
    .where(and(eq(managers.status, "active"), ...(linked.length ? [inArray(managers.id, linked.map((l) => l.id))] : [])));
  return {
    staff: [
      ...admins.filter((a) => a.email).map((a) => ({ email: a.email!, name: a.name ?? "Administrateur", role: "admin" as const })),
      ...mgrs.filter((m) => m.email).map((m) => ({ email: m.email!, name: m.first, role: "manager" as const })),
    ],
    associated: linked.length ? mgrs.map((m) => `${m.first} ${m.last}`) : [],
  };
}

/** Invitation d'un nouveau gestionnaire (modèle "Invitation gestionnaire"). */
export async function notifyManagerInvite(managerId: string, token: string, locale: string) {
  const e = await fr();
  const m = await db.query.managers.findFirst({ where: eq(managers.id, managerId), with: { user: { columns: { email: true } } } });
  if (!m?.user.email) return;
  const link = `${APP_BASE_URL}/${locale}/set-password?token=${token}`;
  await sendTemplate("manager_invite", [
    {
      to: m.user.email,
      vars: {
        civilite: m.civility === "female" ? "Madame" : "Monsieur",
        prenom: m.firstName,
        nom: m.lastName,
        email: m.user.email,
        telephone: m.phone,
        ville: m.city,
        type_contrat: e(`contract.${m.contractType}`),
        date_debut: fmtDate(m.workStartDate),
        lien_invitation: link,
        bouton_invitation: emailButton("Choisir mon mot de passe", link),
      },
    },
  ]);
}

/** Nouvelle voiture : prévient l'administrateur et tous les gestionnaires actifs. */
export async function notifyCarCreated(carId: string, actorName: string) {
  const e = await fr();
  const car = await db.query.cars.findFirst({ where: (c, { eq: q }) => q(c.id, carId), with: { agency: true } });
  if (!car) return;
  const all = await staffFor(null);
  const { associated } = await staffFor(carId);
  const vars = {
    marque: car.brand,
    modele: car.model,
    annee: String(car.year),
    carrosserie: e(`category.${car.category}`),
    motorisation: e(`fuel.${car.fuel}`),
    transmission: e(`transmission.${car.transmission}`),
    immatriculation: car.plateNumber,
    couleur: car.colorName,
    prix_jour: money(car.dailyPrice),
    agence: `${car.agency.city}, ${car.agency.name}`,
    gestionnaires: associated.length ? associated.join(", ") : "Tous les gestionnaires",
    ajoute_par: actorName,
  };
  await sendTemplate(
    "car_created",
    all.staff.map((s) => {
      const link = `${APP_BASE_URL}/fr/${s.role === "admin" ? "admin" : "manager"}/fleet/${car.id}`;
      return { to: s.email, vars: { ...vars, lien_voiture: link, bouton_voiture: emailButton("Voir la voiture", link) } };
    }),
  );
}

/** Nouvelle réservation : le client, l'administrateur et les gestionnaires de la voiture. */
export async function notifyReservationCreated(reservationId: string) {
  const e = await fr();
  const r = await db.query.reservations.findFirst({
    where: eq(reservations.id, reservationId),
    with: { car: true, client: true, pickupAgency: true, returnAgency: true, promotion: true, extras: { with: { extra: true } } },
  });
  if (!r) return;
  const messages = (await import("../messages/fr.json")).default;
  const tx = createTranslator({ locale: "fr", messages, namespace: "Extras" });
  const { staff } = await staffFor(r.carId);
  const clientName = `${r.driverFirstName} ${r.driverLastName}`;
  const base = {
    reference: r.reference,
    client_nom: clientName,
    client_email: r.client.email ?? "",
    client_telephone: r.driverPhone,
    marque: r.car.brand,
    modele: r.car.model,
    annee: String(r.car.year),
    carrosserie: e(`category.${r.car.category}`),
    motorisation: e(`fuel.${r.car.fuel}`),
    transmission: e(`transmission.${r.car.transmission}`),
    immatriculation: r.car.plateNumber,
    date_debut: fmtDate(r.startDate),
    date_fin: fmtDate(r.endDate),
    jours: String(r.days),
    prix_jour: money(r.dailyPrice),
    options: r.extras.length ? r.extras.map((x) => (tx.has(x.extra.code as "gps") ? tx(x.extra.code as "gps") : x.extra.code)).join(", ") : "aucune",
    code_promo: r.promotion?.code ?? "",
    remise: r.discountAmount ? money(r.discountAmount) : money(0),
    total: money(r.totalPrice),
    caution: money(r.deposit),
    agence_depart: `${r.pickupAgency.city}, ${r.pickupAgency.name}`,
    agence_retour: `${r.returnAgency.city}, ${r.returnAgency.name}`,
    numero_vol: r.flightNumber ?? "",
  };
  const clientLink = `${APP_BASE_URL}/${r.locale}/account`;
  await sendTemplate("reservation_created", [
    { to: r.client.email, vars: { ...base, destinataire: r.driverFirstName, lien_reservation: clientLink, bouton_reservation: emailButton("Voir ma réservation", clientLink) } },
    ...staff.map((s) => {
      const link = `${APP_BASE_URL}/fr/${s.role === "admin" ? "admin" : "manager"}/reservations/${r.id}`;
      return { to: s.email, vars: { ...base, destinataire: s.name, lien_reservation: link, bouton_reservation: emailButton("Traiter la réservation", link) } };
    }),
  ]);
}
