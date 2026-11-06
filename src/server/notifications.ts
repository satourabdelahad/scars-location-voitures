import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { db } from "@/db";
import { agencies, carManagers, cars, clientProfiles, managerAgencies, managers, marketingCampaigns, marketingRecipients, promotions, reservations, users } from "@/db/schema";
import { formatDate, formatMoney } from "@/lib/utils";
import { APP_BASE_URL, emailButton, sendTemplate } from "@/server/email";
import { isLocale, type Locale } from "@/i18n/config";

/** Libellés (carrosserie, options, boutons…) dans la langue du destinataire. */
async function tr(locale: string | null | undefined) {
  const l: Locale = isLocale(locale ?? "") ? (locale as Locale) : "fr";
  const messages = (await import(`../messages/${l}.json`)).default;
  return {
    locale: l,
    e: createTranslator({ locale: l, messages, namespace: "Enums" }),
    x: createTranslator({ locale: l, messages, namespace: "Extras" }),
    m: createTranslator({ locale: l, messages, namespace: "Email" }),
    date: (d: string) => formatDate(d, l),
    money: (n: number) => formatMoney(n, l),
  };
}

type Staff = { email: string; name: string; role: "admin" | "manager"; locale: string | null };

/** Administrateurs actifs + gestionnaires actifs associés à la voiture (tous s'il n'y en a aucun). */
async function staffFor(carId: string | null): Promise<{ staff: Staff[]; associated: string[] }> {
  const admins = await db
    .select({ email: users.email, name: users.name, locale: users.preferredLocale })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active")));
  const linked = carId
    ? await db.select({ id: carManagers.managerId }).from(carManagers).where(eq(carManagers.carId, carId))
    : [];
  const mgrs = await db
    .select({ email: users.email, first: managers.firstName, last: managers.lastName, locale: users.preferredLocale })
    .from(managers)
    .innerJoin(users, eq(users.id, managers.userId))
    .where(and(eq(managers.status, "active"), ...(linked.length ? [inArray(managers.id, linked.map((l) => l.id))] : [])));
  return {
    staff: [
      ...admins.filter((a) => a.email).map((a) => ({ email: a.email!, name: a.name ?? "Admin", role: "admin" as const, locale: a.locale })),
      ...mgrs.filter((m) => m.email).map((m) => ({ email: m.email!, name: m.first, role: "manager" as const, locale: m.locale })),
    ],
    associated: linked.length ? mgrs.map((m) => `${m.first} ${m.last}`) : [],
  };
}

/** Invitation d'un nouveau gestionnaire (modèle "Invitation gestionnaire", dans la langue de l'administrateur). */
export async function notifyManagerInvite(managerId: string, token: string, locale: string) {
  const { e, m: tm, date, locale: l } = await tr(locale);
  const m = await db.query.managers.findFirst({ where: eq(managers.id, managerId), with: { user: { columns: { email: true } } } });
  if (!m?.user.email) return;
  const link = `${APP_BASE_URL}/${l}/set-password?token=${token}`;
  await sendTemplate("manager_invite", [
    {
      to: m.user.email,
      locale: l,
      vars: {
        civilite: e(`civility.${m.civility}`),
        prenom: m.firstName,
        nom: m.lastName,
        email: m.user.email,
        telephone: m.phone,
        ville: m.city,
        type_contrat: e(`contract.${m.contractType}`),
        date_debut: date(m.workStartDate),
        lien_invitation: link,
        bouton_invitation: emailButton(tm("tplBtnInvite"), link),
      },
    },
  ]);
}

/** Invitation d'un client ajouté par l'équipe (modèle "Invitation client", dans la langue du client). */
export async function notifyClientInvite(clientId: string, token: string, actorName: string) {
  const [c] = await db
    .select({ email: users.email, locale: users.preferredLocale, civility: clientProfiles.civility, first: clientProfiles.firstName, last: clientProfiles.lastName })
    .from(users)
    .leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
    .where(eq(users.id, clientId))
    .limit(1);
  if (!c?.email) return { sent: 0, failed: 0, skipped: 1 };
  const { e, m, locale } = await tr(c.locale);
  const link = `${APP_BASE_URL}/${locale}/set-password?token=${token}`;
  return sendTemplate("client_invite", [
    {
      to: c.email,
      locale,
      vars: {
        civilite: c.civility ? e(`civility.${c.civility}`) : "",
        prenom: c.first ?? "",
        nom: c.last ?? "",
        email: c.email,
        ajoute_par: actorName,
        lien_invitation: link,
        bouton_invitation: emailButton(m("tplBtnClientInvite"), link),
      },
    },
  ]);
}

/** Nouveau mot de passe choisi par l'administrateur : envoyé au gestionnaire (modèle "Nouveau mot de passe"). */
export async function notifyManagerPasswordSet(managerId: string, password: string, actorLabel: string) {
  const m = await db.query.managers.findFirst({ where: eq(managers.id, managerId), with: { user: { columns: { email: true, preferredLocale: true } } } });
  if (!m?.user.email) return { sent: 0, failed: 0, skipped: 1 };
  const { e, m: tm, locale } = await tr(m.user.preferredLocale);
  const link = `${APP_BASE_URL}/${locale}/login`;
  return sendTemplate("manager_password_set", [
    {
      to: m.user.email,
      locale,
      vars: {
        civilite: e(`civility.${m.civility}`),
        prenom: m.firstName,
        nom: m.lastName,
        email: m.user.email,
        mot_de_passe: password,
        modifie_par: actorLabel,
        lien_connexion: link,
        bouton_connexion: emailButton(tm("tplBtnLogin"), link),
      },
    },
  ]);
}

/** Nouvelle voiture : prévient l'administrateur et tous les gestionnaires actifs, chacun dans sa langue. */
export async function notifyCarCreated(carId: string, actorName: string) {
  const car = await db.query.cars.findFirst({ where: (c, { eq: q }) => q(c.id, carId), with: { agency: true } });
  if (!car) return;
  const all = await staffFor(null);
  const { associated } = await staffFor(carId);
  const recipients = [];
  for (const s of all.staff) {
    const { e, m, money, locale } = await tr(s.locale);
    const link = `${APP_BASE_URL}/${locale}/${s.role === "admin" ? "admin" : "manager"}/fleet/${car.id}`;
    recipients.push({
      to: s.email,
      locale,
      vars: {
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
        gestionnaires: associated.length ? associated.join(", ") : m("tplAllManagers"),
        ajoute_par: actorName,
        lien_voiture: link,
        bouton_voiture: emailButton(m("tplBtnCar"), link),
      },
    });
  }
  await sendTemplate("car_created", recipients);
}

/** Nouvelle réservation : le client (dans la langue de sa réservation), l'administrateur et les gestionnaires de la voiture. */
export async function notifyReservationCreated(reservationId: string) {
  const r = await db.query.reservations.findFirst({
    where: eq(reservations.id, reservationId),
    with: { car: true, client: true, pickupAgency: true, returnAgency: true, promotion: true, extras: { with: { extra: true } } },
  });
  if (!r) return;
  const { staff } = await staffFor(r.carId);
  const varsFor = async (locale: string | null) => {
    const { e, x, m, date, money, locale: l } = await tr(locale);
    return {
      l,
      m,
      vars: {
        reference: r.reference,
        client_nom: `${r.driverFirstName} ${r.driverLastName}`,
        client_email: r.client.email ?? "",
        client_telephone: r.driverPhone,
        marque: r.car.brand,
        modele: r.car.model,
        annee: String(r.car.year),
        carrosserie: e(`category.${r.car.category}`),
        motorisation: e(`fuel.${r.car.fuel}`),
        transmission: e(`transmission.${r.car.transmission}`),
        immatriculation: r.car.plateNumber,
        date_debut: date(r.startDate),
        date_fin: date(r.endDate),
        jours: String(r.days),
        prix_jour: money(r.dailyPrice),
        options: r.extras.length ? r.extras.map((o) => (x.has(o.extra.code as "gps") ? x(o.extra.code as "gps") : o.extra.code)).join(", ") : m("tplNone"),
        code_promo: r.promotion?.code ?? "",
        remise: money(r.discountAmount ?? 0),
        total: money(r.totalPrice),
        caution: money(r.deposit),
        agence_depart: `${r.pickupAgency.city}, ${r.pickupAgency.name}`,
        agence_retour: `${r.returnAgency.city}, ${r.returnAgency.name}`,
        numero_vol: r.flightNumber ?? "",
      },
    };
  };
  const recipients = [];
  const c = await varsFor(r.locale);
  const clientLink = `${APP_BASE_URL}/${c.l}/account`;
  recipients.push({ to: r.client.email, locale: c.l, vars: { ...c.vars, destinataire: r.driverFirstName, lien_reservation: clientLink, bouton_reservation: emailButton(c.m("tplBtnBooking"), clientLink) } });
  for (const s of staff) {
    const v = await varsFor(s.locale);
    const link = `${APP_BASE_URL}/${v.l}/${s.role === "admin" ? "admin" : "manager"}/reservations/${r.id}`;
    recipients.push({ to: s.email, locale: v.l, vars: { ...v.vars, destinataire: s.name, lien_reservation: link, bouton_reservation: emailButton(v.m("tplBtnProcess"), link) } });
  }
  await sendTemplate("reservation_created", recipients);
}

/** Gestionnaires actifs d'une agence : son responsable et les gestionnaires qui y sont rattachés. */
export async function agencyStaff(agencyId: number) {
  const [agency] = await db.select().from(agencies).where(eq(agencies.id, agencyId)).limit(1);
  if (!agency) return { agency: null, staff: [] as { managerId: string; email: string; first: string; locale: string | null }[] };
  const members = await db.select({ id: managerAgencies.managerId }).from(managerAgencies).where(eq(managerAgencies.agencyId, agencyId));
  // L'administrateur appartient à toutes les agences.
  const admins = await db.select({ id: managers.id }).from(managers).innerJoin(users, eq(users.id, managers.userId)).where(eq(users.role, "admin"));
  const ids = [...new Set([...(agency.managerId ? [agency.managerId] : []), ...members.map((m) => m.id), ...admins.map((m) => m.id)])];
  const rows = ids.length
    ? await db
        .select({ managerId: managers.id, email: users.email, first: managers.firstName, locale: users.preferredLocale })
        .from(managers)
        .innerJoin(users, eq(users.id, managers.userId))
        .where(and(inArray(managers.id, ids), eq(managers.status, "active"), eq(users.status, "active")))
    : [];
  return { agency, staff: rows.filter((r) => r.email).map((r) => ({ ...r, email: r.email! })) };
}

/** Voiture(s) associée(s) à une agence : tous les gestionnaires de l'agence sont prévenus (modèle « Voiture associée à une agence »). */
export async function notifyCarsJoinedAgency(carIds: string[], agencyId: number, actorLabel: string, exceptUserEmail?: string | null) {
  if (!carIds.length) return { sent: 0, failed: 0, skipped: 0 };
  const { agency, staff } = await agencyStaff(agencyId);
  if (!agency) return { sent: 0, failed: 0, skipped: 0 };
  const list = await db.select({ brand: cars.brand, model: cars.model, plate: cars.plateNumber }).from(cars).where(inArray(cars.id, carIds));
  const label = list.map((c) => `${c.brand} ${c.model} (${c.plate})`).join(", ");
  const recipients = [];
  for (const s of staff) {
    if (exceptUserEmail && s.email.toLowerCase() === exceptUserEmail.toLowerCase()) continue;
    const { m, locale } = await tr(s.locale);
    const link = `${APP_BASE_URL}/${locale}/manager/agencies/${agency.id}?tab=cars`;
    recipients.push({
      to: s.email,
      locale,
      vars: {
        destinataire: s.first,
        agence: `${agency.city}, ${agency.name}`,
        nombre_voitures: String(list.length),
        voitures: label,
        ajoute_par: actorLabel,
        lien_agence: link,
        bouton_agence: emailButton(m("tplBtnAgency"), link),
      },
    });
  }
  return sendTemplate("car_agency_assigned", recipients);
}

/** Gestionnaire rattaché à une ou plusieurs agences : les gestionnaires de chacune sont prévenus (modèle « Nouveau gestionnaire d'agence »). */
export async function notifyManagerJoinedAgencies(managerId: string, agencyIds: number[], actorLabel: string) {
  const out = { sent: 0, failed: 0, skipped: 0 };
  const [mgr] = await db
    .select({ civility: managers.civility, first: managers.firstName, last: managers.lastName, phone: managers.phone, email: users.email })
    .from(managers)
    .innerJoin(users, eq(users.id, managers.userId))
    .where(eq(managers.id, managerId))
    .limit(1);
  if (!mgr) return out;
  for (const agencyId of agencyIds) {
    const { agency, staff } = await agencyStaff(agencyId);
    if (!agency) continue;
    const recipients = [];
    for (const s of staff) {
      if (s.managerId === managerId) continue;
      const { e, m, locale } = await tr(s.locale);
      const link = `${APP_BASE_URL}/${locale}/manager/agencies/${agency.id}?tab=managers`;
      recipients.push({
        to: s.email,
        locale,
        vars: {
          destinataire: s.first,
          civilite: e(`civility.${mgr.civility}`),
          prenom: mgr.first,
          nom: mgr.last,
          email: mgr.email ?? "",
          telephone: mgr.phone,
          agence: `${agency.city}, ${agency.name}`,
          ajoute_par: actorLabel,
          lien_agence: link,
          bouton_agence: emailButton(m("tplBtnAgency"), link),
        },
      });
    }
    const r = await sendTemplate("manager_agency_joined", recipients);
    out.sent += r.sent;
    out.failed += r.failed;
    out.skipped += r.skipped;
  }
  return out;
}

/** Variables de l'email marketing pour un destinataire (aussi utilisées par l'aperçu). */
export async function marketingVars(
  r: { civility: "male" | "female" | null; first: string; last: string; locale: string | null },
  c: { message: string | null; code: string; percent: number; endsOn: string | null; minDays: number },
  link: string,
) {
  const { e, m, date, locale } = await tr(r.locale);
  return {
    locale,
    vars: {
      civilite: r.civility ? e(`civility.${r.civility}`) : "",
      prenom: r.first,
      nom: r.last,
      message: c.message ?? "",
      code_promo: c.code,
      remise: `${c.percent} %`,
      date_fin: c.endsOn ? date(c.endsOn) : "—",
      jours_min: String(c.minDays),
      lien_promo: link,
      bouton_promo: emailButton(m("tplBtnPromo"), link),
    },
  };
}

/**
 * Envoie la campagne à ses destinataires (modèle « Email marketing : code de réduction »), chacun dans sa langue.
 * Le bouton de l'email ouvre /api/promo/<jeton> : le code est alors attribué au client.
 */
export async function sendMarketingCampaign(campaignId: number) {
  const [c] = await db
    .select({ id: marketingCampaigns.id, message: marketingCampaigns.message, code: promotions.code, value: promotions.value, endsOn: promotions.endsOn, minDays: promotions.minDays })
    .from(marketingCampaigns)
    .innerJoin(promotions, eq(promotions.id, marketingCampaigns.promotionId))
    .where(eq(marketingCampaigns.id, campaignId))
    .limit(1);
  if (!c) return { sent: 0, failed: 0, skipped: 0 };
  const list = await db
    .select({
      clientId: marketingRecipients.clientId,
      token: marketingRecipients.token,
      email: marketingRecipients.email,
      locale: users.preferredLocale,
      civility: clientProfiles.civility,
      first: clientProfiles.firstName,
      last: clientProfiles.lastName,
      name: users.name,
    })
    .from(marketingRecipients)
    .innerJoin(users, eq(users.id, marketingRecipients.clientId))
    .leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
    .where(eq(marketingRecipients.campaignId, campaignId));
  const out = { sent: 0, failed: 0, skipped: 0 };
  for (const r of list) {
    const [first, ...rest] = (r.name ?? "").split(" ");
    const loc = isLocale(r.locale ?? "") ? r.locale! : "fr";
    const link = `${APP_BASE_URL}/api/promo/${r.token}?l=${loc}`;
    const { locale, vars } = await marketingVars(
      { civility: r.civility, first: r.first ?? first ?? "", last: r.last ?? rest.join(" "), locale: r.locale },
      { message: c.message, code: c.code, percent: c.value, endsOn: c.endsOn, minDays: c.minDays },
      link,
    );
    const res = await sendTemplate("marketing_promotion", [{ to: r.email, locale, vars }]).catch(() => ({ sent: 0, failed: 1, skipped: 0 }));
    out.sent += res.sent;
    out.failed += res.failed;
    out.skipped += res.skipped;
    await db
      .update(marketingRecipients)
      .set(res.sent ? { sentAt: new Date() } : { failed: res.failed > 0 })
      .where(and(eq(marketingRecipients.campaignId, campaignId), eq(marketingRecipients.clientId, r.clientId)));
  }
  await db.update(marketingCampaigns).set({ sentCount: out.sent, failedCount: out.failed }).where(eq(marketingCampaigns.id, campaignId));
  return out;
}
