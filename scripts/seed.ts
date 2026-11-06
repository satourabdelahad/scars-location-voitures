/**
 * Données de départ : agences, options, administrateur, et (avec --demo) un parc et un historique de démonstration.
 *   npm run db:seed            → agences + options + administrateur
 *   npm run db:seed -- --demo  → + gestionnaires, voitures, clients et réservations fictifs
 */
import "./load-env";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant");
const pool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true } });
const db = drizzle(pool, { schema, casing: "snake_case" });
const { agencies, extras, users, managers, managerEvents, cars, carTranslations, reservations, reservationExtras } = schema;

const AGENCIES = [
  { slug: "marrakech-gueliz", city: "Marrakech", name: "Agence Guéliz", address: "Avenue Mohammed V, Guéliz, Marrakech", phone: "+212524000101", isAirport: false },
  { slug: "marrakech-rak", city: "Marrakech", name: "Aéroport Marrakech-Ménara", address: "Terminal 1, Aéroport Marrakech-Ménara", phone: "+212524000102", isAirport: true },
  { slug: "casablanca-maarif", city: "Casablanca", name: "Agence Maârif", address: "Boulevard Al Massira, Maârif, Casablanca", phone: "+212522000201", isAirport: false },
  { slug: "casablanca-cmn", city: "Casablanca", name: "Aéroport Mohammed V", address: "Terminal 2, Aéroport Mohammed V, Nouaceur", phone: "+212522000202", isAirport: true },
  { slug: "agadir-centre", city: "Agadir", name: "Agence Front de mer", address: "Boulevard du 20 Août, Agadir", phone: "+212528000301", isAirport: false },
  { slug: "tanger-centre", city: "Tanger", name: "Agence Malabata", address: "Avenue Mohammed VI, Malabata, Tanger", phone: "+212539000401", isAirport: false },
  { slug: "fes-centre", city: "Fès", name: "Agence Ville nouvelle", address: "Avenue Hassan II, Fès", phone: "+212535000501", isAirport: false },
  { slug: "rabat-agdal", city: "Rabat", name: "Agence Agdal", address: "Avenue de France, Agdal, Rabat", phone: "+212537000601", isAirport: false },
];

const EXTRAS = [
  { code: "full_insurance", pricePerDay: 120 },
  { code: "extra_driver", pricePerDay: 50 },
  { code: "child_seat", pricePerDay: 30 },
  { code: "gps", pricePerDay: 25 },
  { code: "wifi", pricePerDay: 35 },
];

type CarSeed = Omit<typeof cars.$inferInsert, "agencyId"> & { agency: string; fr: string };
const CARS: CarSeed[] = [
  { brand: "Dacia", model: "Logan", year: 2024, category: "sedan", transmission: "manual", fuel: "diesel", seats: 5, doors: 4, luggage: 3, colorName: "Blanc glacier", colorHex: "#E9ECF2", plateNumber: "12345-A-40", mileage: 21000, dailyPrice: 250, deposit: 5000, agency: "marrakech-rak", fr: "La berline la plus louée du Maroc : sobre, robuste et économique, idéale pour les longs trajets entre villes." },
  { brand: "Dacia", model: "Sandero Stepway", year: 2025, category: "crossover", transmission: "manual", fuel: "petrol", seats: 5, doors: 5, luggage: 2, colorName: "Orange Atacama", colorHex: "#D9772B", plateNumber: "23456-B-40", mileage: 8000, dailyPrice: 290, deposit: 5000, agency: "marrakech-gueliz", fr: "Garde au sol relevée et coffre généreux : parfaite pour les pistes de la vallée de l'Ourika." },
  { brand: "Renault", model: "Clio 5", year: 2024, category: "city_car", transmission: "automatic", fuel: "petrol", seats: 5, doors: 5, luggage: 2, colorName: "Bleu Iron", colorHex: "#2E4A7D", plateNumber: "34567-A-6", mileage: 15000, dailyPrice: 320, deposit: 6000, agency: "casablanca-cmn", fr: "Citadine automatique, agréable dans la circulation de Casablanca et confortable sur autoroute." },
  { brand: "Peugeot", model: "208", year: 2025, category: "city_car", transmission: "automatic", fuel: "petrol", seats: 5, doors: 5, luggage: 2, colorName: "Gris Sélénium", colorHex: "#5B6170", plateNumber: "45678-B-6", mileage: 6000, dailyPrice: 340, deposit: 6000, agency: "casablanca-maarif", fr: "Compacte moderne avec écran tactile, CarPlay et aide au stationnement." },
  { brand: "Hyundai", model: "Accent", year: 2024, category: "sedan", transmission: "automatic", fuel: "petrol", seats: 5, doors: 4, luggage: 3, colorName: "Argent", colorHex: "#BFC5CF", plateNumber: "56789-A-33", mileage: 19000, dailyPrice: 380, deposit: 7000, agency: "agadir-centre", fr: "Berline spacieuse et silencieuse, appréciée des familles pour la route Agadir–Essaouira." },
  { brand: "Toyota", model: "Corolla Hybride", year: 2025, category: "sedan", transmission: "automatic", fuel: "hybrid", seats: 5, doors: 4, luggage: 3, colorName: "Blanc nacré", colorHex: "#F3F1EC", plateNumber: "67890-B-1", mileage: 4000, dailyPrice: 450, deposit: 8000, agency: "rabat-agdal", fr: "Hybride sobre (4,5 L/100 km), idéale pour les déplacements professionnels entre Rabat et Casablanca." },
  { brand: "Dacia", model: "Duster", year: 2025, category: "suv_4x4", transmission: "manual", fuel: "diesel", seats: 5, doors: 5, luggage: 3, colorName: "Vert Kaki", colorHex: "#6F7A4B", plateNumber: "78901-A-40", mileage: 12000, dailyPrice: 420, deposit: 8000, agency: "marrakech-gueliz", fr: "Le 4x2 robuste pour l'Atlas : col du Tichka, Aït-Ben-Haddou, Ouarzazate." },
  { brand: "Toyota", model: "Land Cruiser Prado", year: 2024, category: "suv_4x4", transmission: "automatic", fuel: "diesel", seats: 7, doors: 5, luggage: 4, colorName: "Noir", colorHex: "#1E2128", plateNumber: "89012-B-40", mileage: 32000, dailyPrice: 1300, deposit: 20000, agency: "marrakech-rak", fr: "Vrai 4x4 sept places pour le désert de Merzouga et les pistes du Sud." },
  { brand: "Hyundai", model: "Tucson", year: 2025, category: "suv_4x4", transmission: "automatic", fuel: "hybrid", seats: 5, doors: 5, luggage: 3, colorName: "Bleu Intense", colorHex: "#24407A", plateNumber: "90123-A-6", mileage: 7000, dailyPrice: 690, deposit: 12000, agency: "casablanca-cmn", fr: "SUV hybride confortable, toit panoramique et sièges chauffants." },
  { brand: "Mercedes-Benz", model: "Classe C", year: 2025, category: "sedan", transmission: "automatic", fuel: "diesel", seats: 5, doors: 4, luggage: 3, colorName: "Gris Graphite", colorHex: "#3B3F48", plateNumber: "11223-B-6", mileage: 9000, dailyPrice: 1100, deposit: 25000, agency: "casablanca-maarif", fr: "Berline premium pour vos rendez-vous d'affaires et vos événements." },
  { brand: "Land Rover", model: "Range Rover Evoque", year: 2024, category: "suv_4x4", transmission: "automatic", fuel: "petrol", seats: 5, doors: 5, luggage: 2, colorName: "Blanc Fuji", colorHex: "#EEF0F2", plateNumber: "22334-A-40", mileage: 14000, dailyPrice: 1450, deposit: 30000, agency: "marrakech-gueliz", fr: "SUV de luxe compact, très demandé pour les mariages et les séjours à la Palmeraie." },
  { brand: "Volkswagen", model: "Caravelle", year: 2024, category: "minivan", transmission: "automatic", fuel: "diesel", seats: 9, doors: 4, luggage: 6, colorName: "Gris Indium", colorHex: "#7D828C", plateNumber: "33445-B-1", mileage: 41000, dailyPrice: 950, deposit: 15000, agency: "rabat-agdal", fr: "Neuf places et grand coffre pour les familles nombreuses et les groupes." },
  { brand: "Dacia", model: "Lodgy", year: 2023, category: "mpv", transmission: "manual", fuel: "diesel", seats: 7, doors: 5, luggage: 4, colorName: "Bleu Cosmos", colorHex: "#2F3D66", plateNumber: "44556-A-33", mileage: 52000, dailyPrice: 480, deposit: 7000, agency: "agadir-centre", fr: "Sept places au prix d'une berline, parfait pour une famille avec bagages." },
  { brand: "Mini", model: "Cooper Cabriolet", year: 2024, category: "cabriolet", transmission: "automatic", fuel: "petrol", seats: 4, doors: 2, luggage: 1, colorName: "Jaune Zesty", colorHex: "#E9C33B", plateNumber: "55667-B-33", mileage: 11000, dailyPrice: 890, deposit: 15000, agency: "agadir-centre", fr: "Capote ouverte sur la corniche d'Agadir et la route de Taghazout." },
  { brand: "Toyota", model: "Hilux", year: 2024, category: "pickup", transmission: "manual", fuel: "diesel", seats: 5, doors: 4, luggage: 5, colorName: "Blanc", colorHex: "#F1F2F4", plateNumber: "66778-A-8", mileage: 38000, dailyPrice: 750, deposit: 12000, agency: "fes-centre", fr: "Double cabine 4x4, solide et polyvalent, pour le Moyen Atlas et les chantiers." },
  { brand: "Fiat", model: "500", year: 2024, category: "micro_car", transmission: "manual", fuel: "petrol", seats: 4, doors: 3, luggage: 1, colorName: "Rouge Passione", colorHex: "#B5262C", plateNumber: "77889-B-8", mileage: 17000, dailyPrice: 260, deposit: 5000, agency: "tanger-centre", fr: "Petite et maniable, idéale pour se garer près de la Kasbah de Tanger." },
  { brand: "Kia", model: "Picanto", year: 2025, category: "micro_car", transmission: "automatic", fuel: "petrol", seats: 4, doors: 5, luggage: 1, colorName: "Vert Menthe", colorHex: "#7FC6B0", plateNumber: "88990-A-8", mileage: 3000, dailyPrice: 270, deposit: 5000, agency: "fes-centre", fr: "Citadine automatique très économique pour circuler dans Fès." },
  { brand: "Tesla", model: "Model 3", year: 2025, category: "sedan", transmission: "automatic", fuel: "electric", seats: 5, doors: 4, luggage: 3, colorName: "Bleu Outremer", colorHex: "#2B4FA3", plateNumber: "99001-B-6", mileage: 5000, dailyPrice: 980, deposit: 20000, agency: "casablanca-cmn", fr: "Électrique avec 500 km d'autonomie et accès aux Superchargeurs de Casablanca et Marrakech." },
];

const MANAGERS = [
  { civility: "male" as const, firstName: "Youssef", lastName: "El Amrani", email: "youssef@dizycars.com", phone: "+212661234501", city: "Marrakech", birthDate: "1990-04-12", maritalStatus: "married" as const, workStartDate: "2021-03-01", contractType: "cdi" as const },
  { civility: "female" as const, firstName: "Salma", lastName: "Bennani", email: "salma@dizycars.com", phone: "+212661234502", city: "Casablanca", birthDate: "1994-09-30", maritalStatus: "single" as const, workStartDate: "2022-06-15", contractType: "cdi" as const },
  { civility: "male" as const, firstName: "Hamza", lastName: "Ouazzani", email: "hamza@dizycars.com", phone: "+212661234503", city: "Agadir", birthDate: "1988-01-21", maritalStatus: null, workStartDate: "2023-01-09", contractType: "freelance" as const },
  { civility: "female" as const, firstName: "Imane", lastName: "Tazi", email: "imane@dizycars.com", phone: "+212661234504", city: "Rabat", birthDate: "1996-11-05", maritalStatus: "single" as const, workStartDate: "2024-02-19", contractType: "freelance" as const },
  { civility: "male" as const, firstName: "Karim", lastName: "Alaoui", email: "karim@dizycars.com", phone: "+212661234505", city: "Fès", birthDate: "1985-07-17", maritalStatus: "widowed" as const, workStartDate: "2020-09-01", contractType: "cdi" as const },
];

const CLIENTS = [
  ["Emma Laurent", "emma.laurent@example.com", "fr"],
  ["Haruto Sato", "haruto.sato@example.jp", "ja"],
  ["Li Wei", "li.wei@example.cn", "zh"],
  ["Min-jun Park", "minjun.park@example.kr", "ko"],
  ["Lukas Becker", "lukas.becker@example.de", "de"],
  ["Lucía García", "lucia.garcia@example.es", "es"],
  ["Oliver Smith", "oliver.smith@example.co.uk", "en"],
  ["Mehdi Chraibi", "mehdi.chraibi@example.ma", "ary"],
  ["Nadia Fassi", "nadia.fassi@example.ma", "ar"],
] as const;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
/** Pseudo-aléatoire déterministe pour un jeu de démo reproductible. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

async function main() {
  const demo = process.argv.includes("--demo");

  await db.insert(agencies).values(AGENCIES).onConflictDoNothing();
  await db.insert(extras).values(EXTRAS).onConflictDoNothing();
  // Codes promo de départ (le code est unique : relancer le seed ne crée pas de doublon).
  await db
    .insert(schema.promotions)
    .values([
      { code: "BIENVENUE10", label: "Bienvenue -10 %", kind: "percent" as const, value: 10, isActive: true },
      { code: "ETE2026", label: "Été 2026 -15 %", kind: "percent" as const, value: 15, startsOn: "2026-06-01", endsOn: "2026-09-30", isActive: true },
      { code: "LONGUEDUREE", label: "Longue durée -200 MAD", kind: "amount" as const, value: 200, minDays: 7, isActive: true },
      { code: "RAMADAN", label: "Ramadan -12 %", kind: "percent" as const, value: 12, isActive: false },
    ])
    .onConflictDoNothing();

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@dizycars.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangezMoi!2026";
  const adminHash = await bcrypt.hash(adminPassword, 12);
  let [admin] = await db.select().from(users).where(eq(users.email, adminEmail));
  if (!admin) {
    [admin] = await db
      .insert(users)
      .values({ name: "Administrateur", email: adminEmail, role: "admin", passwordHash: adminHash, emailVerified: new Date() })
      .returning();
    console.log(`✓ Administrateur créé : ${adminEmail}`);
  } else {
    // Relancer le seed remet l'administrateur en accord avec SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
    [admin] = await db
      .update(users)
      .set({ role: "admin", status: "active", passwordHash: adminHash })
      .where(eq(users.id, admin.id))
      .returning();
    console.log(`✓ Administrateur ${adminEmail} : mot de passe remis à la valeur de SEED_ADMIN_PASSWORD`);
  }
  // L'administrateur a aussi une fiche gestionnaire (listes, responsable d'agence, voitures suivies).
  await db
    .insert(schema.managers)
    .values({
      userId: admin.id,
      civility: "male",
      lastName: "Administrateur",
      firstName: "Admin",
      phone: admin.phone ?? "",
      whatsapp: admin.phone ?? "",
      city: "",
      birthDate: "1990-01-01",
      workStartDate: new Date().toISOString().slice(0, 10),
      contractType: "cdi",
    })
    .onConflictDoNothing();
  // Téléphone et codes de secours perdus : seule personne ayant accès à la base, on peut couper la double authentification.
  if (process.argv.includes("--reset-2fa")) {
    await db
      .update(users)
      .set({ totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecoveryCodes: null })
      .where(eq(users.id, admin.id));
    await db.delete(schema.loginFailures).where(eq(schema.loginFailures.key, `email:${adminEmail}`));
    console.log(`✓ Double authentification désactivée pour ${adminEmail} : réactivez-la depuis Administration → Sécurité`);
  }

  if (!demo) {
    console.log("✓ Agences et options prêtes. Ajoutez --demo pour un jeu de démonstration.");
    return;
  }

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(cars);
  if (n > 0) {
    console.log("Le parc contient déjà des voitures : jeu de démo ignoré.");
    return;
  }

  const agencyRows = await db.select().from(agencies);
  const agencyId = (slug: string) => agencyRows.find((a) => a.slug === slug)!.id;
  const demoPassword = await bcrypt.hash("Gestion2026!", 12);

  const managerUsers: string[] = [];
  for (const m of MANAGERS) {
    const [u] = await db
      .insert(users)
      .values({ name: `${m.firstName} ${m.lastName}`, email: m.email, role: "manager", passwordHash: demoPassword, phone: m.phone, emailVerified: new Date(), lastLoginAt: addDays(new Date(), -Math.floor(Math.random() * 6)) })
      .returning();
    const [mg] = await db
      .insert(managers)
      .values({ userId: u.id, civility: m.civility, firstName: m.firstName, lastName: m.lastName, phone: m.phone, whatsapp: m.phone, city: m.city, birthDate: m.birthDate, maritalStatus: m.maritalStatus, workStartDate: m.workStartDate, contractType: m.contractType, createdBy: admin.id, adminUpdatedAt: new Date(), adminUpdatedBy: admin.id })
      .returning();
    await db.insert(managerEvents).values({ managerId: mg.id, event: "created", actorId: admin.id });
    managerUsers.push(u.id);
  }

  const carRows = [];
  for (const [i, c] of CARS.entries()) {
    const { agency, fr, ...rest } = c;
    // Achat : ville de l'agence, quelques mois avant la mise en location, prix ≈ 300 jours de location.
    const purchase = {
      purchaseCity: AGENCIES.find((a) => a.slug === agency)?.city ?? "Casablanca",
      purchaseDate: `${rest.year}-0${1 + (i % 9)}-15`,
      purchasePrice: Math.round((rest.dailyPrice * 300) / 1000) * 1000,
    };
    const [row] = await db.insert(cars).values({ ...rest, ...purchase, agencyId: agencyId(agency), createdBy: admin.id }).returning();
    await db.insert(carTranslations).values({ carId: row.id, locale: "fr", description: fr });
    carRows.push(row);
  }

  const clientIds: { id: string; locale: string; name: string }[] = [];
  for (const [name, email, locale] of CLIENTS) {
    const [u] = await db.insert(users).values({ name, email, role: "client", preferredLocale: locale, emailVerified: new Date() }).returning();
    clientIds.push({ id: u.id, locale, name });
  }
  // Un client de démo avec mot de passe, pour tester l'espace réservation.
  const [demoClient] = await db
    .insert(users)
    .values({ name: "Client Démo", email: "client@dizycars.com", role: "client", passwordHash: await bcrypt.hash("Client2026!", 12), emailVerified: new Date() })
    .returning();
  clientIds.push({ id: demoClient.id, locale: "fr", name: "Client Démo" });

  // Historique : réservations sur 12 mois, sans chevauchement par voiture.
  const rand = rng(42);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const extraRows = await db.select().from(extras);
  let ref = 0;
  for (const car of carRows) {
    let cursor = addDays(today, -360 + Math.floor(rand() * 10));
    while (cursor < addDays(today, 40)) {
      const days = 2 + Math.floor(rand() * 7);
      const start = cursor;
      const end = addDays(start, days);
      const client = clientIds[Math.floor(rand() * clientIds.length)];
      const handler = managerUsers[Math.floor(rand() * managerUsers.length)];
      const inPast = end <= today;
      const ongoing = start <= today && end > today;
      const status = inPast ? (rand() < 0.08 ? "cancelled" : "completed") : ongoing ? "ongoing" : rand() < 0.45 ? "pending" : "confirmed";
      const proposed = addDays(start, -1 - Math.floor(rand() * 5));
      const now = new Date(Date.now() - Math.floor(rand() * 20) * 3_600_000);
      const confirmedAt = status === "pending" ? null : proposed > now ? now : proposed;
      const chosen = extraRows.filter(() => rand() < 0.25);
      const extrasTotal = chosen.reduce((s, x) => s + x.pricePerDay * days, 0);
      ref++;
      const [r] = await db
        .insert(reservations)
        .values({
          reference: `SCR-${start.getUTCFullYear()}-${String(ref).padStart(6, "0")}`,
          carId: car.id,
          clientId: client.id,
          pickupAgencyId: car.agencyId,
          returnAgencyId: car.agencyId,
          startDate: isoDate(start),
          endDate: isoDate(end),
          days,
          dailyPrice: car.dailyPrice,
          extrasTotal,
          totalPrice: car.dailyPrice * days + extrasTotal,
          deposit: car.deposit,
          status,
          driverFirstName: client.name.split(" ")[0],
          driverLastName: client.name.split(" ").slice(1).join(" ") || "—",
          driverPhone: "+33612345678",
          driverLicenseNumber: `LIC-${1000 + ref}`,
          driverBirthDate: "1988-05-10",
          locale: client.locale as "fr",
          handledBy: status === "pending" ? null : handler,
          confirmedAt,
          pickedUpAt: ["ongoing", "completed"].includes(status) ? start : null,
          returnedAt: status === "completed" ? end : null,
          cancelledAt: status === "cancelled" ? addDays(start, -2) : null,
          createdAt: (() => { const c = addDays(start, -3 - Math.floor(rand() * 10)); return c > new Date() ? new Date(Date.now() - Math.floor(rand() * 48) * 3_600_000) : c; })(),
        })
        .returning();
      if (chosen.length)
        await db.insert(reservationExtras).values(chosen.map((x) => ({ reservationId: r.id, extraId: x.id, unitPricePerDay: x.pricePerDay })));
      cursor = addDays(end, 1 + Math.floor(rand() * 12));
    }
  }
  await db.execute(sql`SELECT setval('reservation_ref_seq', ${ref + 1})`);

  // Une voiture désactivée pour la démonstration (vendue).
  const sold = carRows[carRows.length - 3];
  await db
    .update(reservations)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: "Voiture vendue" })
    .where(sql`${reservations.carId} = ${sold.id} AND ${reservations.status} IN ('pending','confirmed')`);
  await db
    .update(cars)
    .set({ status: "deactivated", deactivationReason: "sold", deactivationNote: "Vendue à un particulier, acte du 12/10/2026", deactivatedAt: new Date(), deactivatedBy: admin.id })
    .where(eq(cars.id, sold.id));

  // Un gestionnaire désactivé, avec son motif.
  const [lastManager] = await db.select().from(managers).where(eq(managers.userId, managerUsers[managerUsers.length - 1]));
  await db.update(managers).set({ status: "deactivated", deactivationReason: "Fin de contrat freelance", deactivatedAt: new Date() }).where(eq(managers.id, lastManager.id));
  await db.update(users).set({ status: "deactivated" }).where(eq(users.id, lastManager.userId));
  await db.insert(managerEvents).values({ managerId: lastManager.id, event: "deactivated", reason: "Fin de contrat freelance", actorId: admin.id });

  console.log(`✓ Démo : ${MANAGERS.length} gestionnaires (mot de passe Gestion2026!), ${CARS.length} voitures, ${ref} réservations, client@dizycars.com / Client2026!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
