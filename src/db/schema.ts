import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/* ───────────────────────────── Énumérations ───────────────────────────── */

export const roleEnum = pgEnum("role", ["admin", "manager", "client"]);
export const accountStatusEnum = pgEnum("account_status", ["active", "deactivated"]);
export const civilityEnum = pgEnum("civility", ["male", "female"]);
export const maritalStatusEnum = pgEnum("marital_status", ["married", "widowed", "single"]);
export const contractTypeEnum = pgEnum("contract_type", ["cdi", "cdd", "freelance"]);
export const managerEventEnum = pgEnum("manager_event", ["created", "updated", "deactivated", "reactivated", "activated"]);
export const documentKindEnum = pgEnum("document_kind", [
  "cin_front",
  "cin_back",
  "license_front",
  "license_back",
]);
/** Carrosserie (cahier des charges : 14 types) */
export const carCategoryEnum = pgEnum("car_category", [
  "city_car",
  "micro_car",
  "compact",
  "sedan",
  "estate",
  "coupe",
  "cabriolet",
  "cc",
  "suv_4x4",
  "crossover",
  "mpv",
  "pickup",
  "minivan",
  "van",
]);
export const transmissionEnum = pgEnum("transmission", ["manual", "automatic", "semi_automatic"]);
/** Motorisation */
export const fuelEnum = pgEnum("fuel", ["petrol", "diesel", "electric", "hybrid", "plug_in_hybrid"]);
/** active = en service (disponible ou en location selon les réservations), maintenance = en réparation */
export const carStatusEnum = pgEnum("car_status", ["active", "maintenance", "deactivated"]);
export const carDeactivationReasonEnum = pgEnum("car_deactivation_reason", [
  "stolen",
  "sold",
  "totaled",
  "accident",
  "end_of_lease",
  "other",
]);
export const reservationStatusEnum = pgEnum("reservation_status", [
  "pending",
  "confirmed",
  "ongoing",
  "completed",
  "cancelled",
  "rejected",
]);
export const tokenPurposeEnum = pgEnum("token_purpose", ["invite", "reset"]);
export const promotionKindEnum = pgEnum("promotion_kind", ["percent", "amount"]);
export const dealTypeEnum = pgEnum("deal_type", ["prospect", "question", "negotiation", "rental", "cancellation", "promotion"]);
export const appointmentKindEnum = pgEnum("appointment_kind", ["meeting", "call", "delivery", "test_drive", "other"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["planned", "done", "cancelled", "no_show"]);
export const dealSourceEnum = pgEnum("deal_source", ["website", "phone", "whatsapp", "walk_in", "social", "referral", "other"]);

export const LOCALES = ["fr", "ary", "ar", "en", "es", "de", "ja", "zh", "ko"] as const;
export const localeEnum = pgEnum("locale", LOCALES);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ───────────────────────── Utilisateurs & Auth.js ───────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    email: varchar("email", { length: 255 }).unique(),
    emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
    image: text("image"),
    role: roleEnum("role").notNull().default("client"),
    status: accountStatusEnum("status").notNull().default("active"),
    passwordHash: text("password_hash"),
    phone: varchar("phone", { length: 32 }),
    preferredLocale: localeEnum("preferred_locale"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "date" }),
    /** Dernière activité (mise à jour au plus une fois par minute) : sert à afficher « En ligne » */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }),
    /** Double authentification (TOTP). Secrets chiffrés en AES-256-GCM avec une clé dérivée d'AUTH_SECRET. */
    totpSecret: text("totp_secret"),
    totpPendingSecret: text("totp_pending_secret"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true, mode: "date" }),
    /** Dernier pas de 30 s accepté : un même code ne peut pas servir deux fois. */
    totpLastStep: integer("totp_last_step"),
    /** Codes de secours (empreintes SHA-256), chacun utilisable une seule fois. */
    totpRecoveryCodes: jsonb("totp_recovery_codes").$type<string[]>(),
    /** Connexion bloquée jusqu'à cette date après trop d'échecs (null = non bloqué). L'administrateur peut le lever. */
    loginLockedUntil: timestamp("login_locked_until", { withTimezone: true, mode: "date" }),
    /** Dernière ouverture du menu Notifications : les événements plus récents sont « non lus » */
    notificationsSeenAt: timestamp("notifications_seen_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (t) => [index("users_role_idx").on(t.role)],
);

/** Échecs de connexion, par email et par adresse IP, pour bloquer les essais en série. */
export const loginFailures = pgTable(
  "login_failures",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 300 }).notNull(),
    /** Email tenté : permet de lever aussi le blocage par IP lors d'un déblocage manuel */
    email: varchar("email", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("login_failures_key_idx").on(t.key, t.createdAt)],
);

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] }), index("accounts_user_idx").on(t.userId)],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/** Jetons d'invitation (création de mot de passe) et de réinitialisation. Seul le hash est stocké. */
export const passwordTokens = pgTable(
  "password_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    purpose: tokenPurposeEnum("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("password_tokens_user_idx").on(t.userId)],
);

/* ─────────────────────────────── Agences ─────────────────────────────── */

export const agencies = pgTable("agencies", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  city: varchar("city", { length: 120 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  address: text("address").notNull(),
  phone: varchar("phone", { length: 32 }),
  whatsapp: varchar("whatsapp", { length: 32 }),
  isAirport: boolean("is_airport").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  /** Site web et réseaux sociaux de l'agence (facultatifs) */
  websiteUrl: varchar("website_url", { length: 300 }),
  facebookUrl: varchar("facebook_url", { length: 300 }),
  instagramUrl: varchar("instagram_url", { length: 300 }),
  linkedinUrl: varchar("linkedin_url", { length: 300 }),
  xUrl: varchar("x_url", { length: 300 }),
  tiktokUrl: varchar("tiktok_url", { length: 300 }),
  /** Responsable de l'agence : un compte gestionnaire (ses coordonnées sont recopiées ci-dessous) */
  managerId: uuid("manager_id"),
  managerCivility: civilityEnum("manager_civility"),
  managerLastName: varchar("manager_last_name", { length: 120 }),
  managerFirstName: varchar("manager_first_name", { length: 120 }),
  managerEmail: varchar("manager_email", { length: 255 }),
  managerPhone: varchar("manager_phone", { length: 32 }),
  deactivationReason: text("deactivation_reason"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  ...timestamps,
});

/* ───────────────────────────── Gestionnaires ───────────────────────────── */

export const managers = pgTable(
  "managers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    civility: civilityEnum("civility").notNull(),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    whatsapp: varchar("whatsapp", { length: 32 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    birthDate: date("birth_date", { mode: "string" }).notNull(),
    maritalStatus: maritalStatusEnum("marital_status"),
    workStartDate: date("work_start_date", { mode: "string" }).notNull(),
    contractType: contractTypeEnum("contract_type").notNull(),
    /** Photo de profil (Cloudinary, image publique) */
    photoUrl: text("photo_url"),
    photoPublicId: text("photo_public_id"),
    status: accountStatusEnum("status").notNull().default("active"),
    deactivationReason: text("deactivation_reason"),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true, mode: "date" }),
    createdBy: uuid("created_by").references(() => users.id),
    adminUpdatedAt: timestamp("admin_updated_at", { withTimezone: true, mode: "date" }),
    adminUpdatedBy: uuid("admin_updated_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("managers_status_idx").on(t.status),
    index("managers_name_idx").on(t.lastName, t.firstName),
    check(
      "managers_deactivation_reason_chk",
      sql`${t.status} = 'active' OR (${t.deactivationReason} IS NOT NULL AND length(trim(${t.deactivationReason})) >= 3)`,
    ),
  ],
);

export const managerDocuments = pgTable(
  "manager_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    managerId: uuid("manager_id")
      .notNull()
      .references(() => managers.id, { onDelete: "restrict" }),
    kind: documentKindEnum("kind").notNull(),
    publicId: text("public_id").notNull(),
    resourceType: varchar("resource_type", { length: 16 }).notNull().default("image"),
    format: varchar("format", { length: 16 }),
    bytes: integer("bytes"),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("manager_documents_kind_uq").on(t.managerId, t.kind)],
);

/** Historique : création, modifications, désactivations (avec motif) et réactivations. */
export const managerEvents = pgTable(
  "manager_events",
  {
    id: serial("id").primaryKey(),
    managerId: uuid("manager_id")
      .notNull()
      .references(() => managers.id, { onDelete: "restrict" }),
    event: managerEventEnum("event").notNull(),
    reason: text("reason"),
    changes: jsonb("changes").$type<Record<string, { from: unknown; to: unknown }>>(),
    actorId: uuid("actor_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("manager_events_manager_idx").on(t.managerId, t.createdAt)],
);

/* ──────────────────────────────── Parc ──────────────────────────────── */

export const cars = pgTable(
  "cars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: integer("agency_id")
      .notNull()
      .references(() => agencies.id),
    brand: varchar("brand", { length: 80 }).notNull(),
    model: varchar("model", { length: 80 }).notNull(),
    year: smallint("year").notNull(),
    category: carCategoryEnum("category").notNull(),
    transmission: transmissionEnum("transmission").notNull(),
    fuel: fuelEnum("fuel").notNull(),
    seats: smallint("seats").notNull(),
    doors: smallint("doors").notNull(),
    luggage: smallint("luggage").notNull().default(2),
    colorName: varchar("color_name", { length: 60 }).notNull(),
    colorHex: varchar("color_hex", { length: 7 }).notNull().default("#9AA3B5"),
    plateNumber: varchar("plate_number", { length: 32 }).notNull().unique(),
    vin: varchar("vin", { length: 17 }).unique(),
    mileage: integer("mileage").notNull().default(0),
    dailyPrice: numeric("daily_price", { precision: 10, scale: 2, mode: "number" }).notNull(),
    deposit: numeric("deposit", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
    airConditioning: boolean("air_conditioning").notNull().default(true),
    /** Promotion de la voiture : remise en % sur le prix par jour, éventuellement limitée à une période */
    promoPercent: smallint("promo_percent"),
    promoStartsOn: date("promo_starts_on", { mode: "string" }),
    promoEndsOn: date("promo_ends_on", { mode: "string" }),
    /** Données d'achat : visibles uniquement par l'équipe, jamais sur le site public */
    purchaseCity: varchar("purchase_city", { length: 120 }),
    purchaseDate: date("purchase_date", { mode: "string" }),
    purchasePrice: numeric("purchase_price", { precision: 12, scale: 2, mode: "number" }),
    status: carStatusEnum("status").notNull().default("active"),
    deactivationReason: carDeactivationReasonEnum("deactivation_reason"),
    deactivationNote: text("deactivation_note"),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true, mode: "date" }),
    deactivatedBy: uuid("deactivated_by").references(() => users.id),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("cars_status_idx").on(t.status),
    index("cars_category_idx").on(t.category),
    index("cars_agency_idx").on(t.agencyId),
    check("cars_year_chk", sql`${t.year} BETWEEN 1990 AND 2100`),
    check("cars_price_chk", sql`${t.dailyPrice} > 0`),
    check("cars_seats_chk", sql`${t.seats} BETWEEN 1 AND 20`),
    check("cars_promo_chk", sql`${t.promoPercent} IS NULL OR ${t.promoPercent} BETWEEN 1 AND 90`),
    check("cars_promo_dates_chk", sql`${t.promoStartsOn} IS NULL OR ${t.promoEndsOn} IS NULL OR ${t.promoEndsOn} >= ${t.promoStartsOn}`),
    check("cars_purchase_price_chk", sql`${t.purchasePrice} IS NULL OR ${t.purchasePrice} >= 0`),
    check(
      "cars_deactivation_chk",
      sql`${t.status} <> 'deactivated' OR (${t.deactivationReason} IS NOT NULL AND ${t.deactivatedAt} IS NOT NULL)`,
    ),
  ],
);

export const carTranslations = pgTable(
  "car_translations",
  {
    carId: uuid("car_id")
      .notNull()
      .references(() => cars.id, { onDelete: "restrict" }),
    locale: localeEnum("locale").notNull(),
    description: text("description").notNull(),
  },
  (t) => [primaryKey({ columns: [t.carId, t.locale] })],
);

export const carImages = pgTable(
  "car_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carId: uuid("car_id")
      .notNull()
      .references(() => cars.id, { onDelete: "restrict" }),
    publicId: text("public_id").notNull(),
    url: text("url").notNull(),
    width: integer("width"),
    height: integer("height"),
    position: smallint("position").notNull().default(0),
    /** Vue : main (photo principale), front, back, left, right, top, interior, dashboard, trunk, other */
    view: varchar("view", { length: 16 }).notNull().default("other"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("car_images_car_idx").on(t.carId, t.position)],
);

/* ───────────────────────────── Réservations ───────────────────────────── */

export const extras = pgTable("extras", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  pricePerDay: numeric("price_per_day", { precision: 10, scale: 2, mode: "number" }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

/** Codes promo : pourcentage ou montant fixe, sur une période, avec une durée minimale de location. */
export const promotions = pgTable(
  "promotions",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    label: varchar("label", { length: 160 }).notNull(),
    kind: promotionKindEnum("kind").notNull(),
    value: numeric("value", { precision: 10, scale: 2, mode: "number" }).notNull(),
    minDays: smallint("min_days").notNull().default(1),
    startsOn: date("starts_on", { mode: "string" }),
    endsOn: date("ends_on", { mode: "string" }),
    isActive: boolean("is_active").notNull().default(true),
    /** Réservée aux clients à qui le code a été attribué (campagne d'email marketing) */
    restricted: boolean("restricted").notNull().default(false),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    check("promotions_value_chk", sql`${t.value} > 0 AND (${t.kind} = 'amount' OR ${t.value} <= 100)`),
    check("promotions_dates_chk", sql`${t.startsOn} IS NULL OR ${t.endsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`),
  ],
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: varchar("reference", { length: 20 }).notNull().unique(),
    carId: uuid("car_id")
      .notNull()
      .references(() => cars.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    pickupAgencyId: integer("pickup_agency_id")
      .notNull()
      .references(() => agencies.id),
    returnAgencyId: integer("return_agency_id")
      .notNull()
      .references(() => agencies.id),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    days: smallint("days").notNull(),
    dailyPrice: numeric("daily_price", { precision: 10, scale: 2, mode: "number" }).notNull(),
    /** Promotion de la voiture appliquée au prix par jour (en %), au moment de la réservation */
    carPromoPercent: smallint("car_promo_percent"),
    extrasTotal: numeric("extras_total", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
    promotionId: integer("promotion_id").references(() => promotions.id),
    discountAmount: numeric("discount_amount", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
    totalPrice: numeric("total_price", { precision: 10, scale: 2, mode: "number" }).notNull(),
    deposit: numeric("deposit", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
    status: reservationStatusEnum("status").notNull().default("pending"),
    driverFirstName: varchar("driver_first_name", { length: 120 }).notNull(),
    driverLastName: varchar("driver_last_name", { length: 120 }).notNull(),
    driverPhone: varchar("driver_phone", { length: 32 }).notNull(),
    /** Permis et date de naissance : facultatifs à la réservation, vérifiés à l'agence */
    driverLicenseNumber: varchar("driver_license_number", { length: 64 }),
    driverBirthDate: date("driver_birth_date", { mode: "string" }),
    flightNumber: varchar("flight_number", { length: 16 }),
    clientNote: text("client_note"),
    internalNote: text("internal_note"),
    locale: localeEnum("locale").notNull().default("fr"),
    handledBy: uuid("handled_by").references(() => users.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true, mode: "date" }),
    returnedAt: timestamp("returned_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    cancelReason: text("cancel_reason"),
    /** Permis vérifié par l'équipe avant la remise des clés */
    licenseCheckedAt: timestamp("license_checked_at", { withTimezone: true, mode: "date" }),
    licenseCheckedBy: uuid("license_checked_by").references(() => users.id),
    driverLicenseExpiresOn: date("driver_license_expires_on", { mode: "string" }),
    /** Prolongation : date de fin d'origine (la première fois qu'on prolonge) */
    originalEndDate: date("original_end_date", { mode: "string" }),
    extendedAt: timestamp("extended_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (t) => [
    index("reservations_car_idx").on(t.carId, t.startDate),
    index("reservations_client_idx").on(t.clientId, t.createdAt),
    index("reservations_handled_idx").on(t.handledBy, t.confirmedAt),
    index("reservations_status_idx").on(t.status),
    check("reservations_dates_chk", sql`${t.endDate} > ${t.startDate}`),
    check("reservations_total_chk", sql`${t.totalPrice} >= 0`),
    check("reservations_discount_chk", sql`${t.discountAmount} >= 0`),
  ],
);

export const reservationExtras = pgTable(
  "reservation_extras",
  {
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservations.id, { onDelete: "restrict" }),
    extraId: integer("extra_id")
      .notNull()
      .references(() => extras.id),
    quantity: smallint("quantity").notNull().default(1),
    unitPricePerDay: numeric("unit_price_per_day", { precision: 10, scale: 2, mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.reservationId, t.extraId] })],
);

/* ───────────────────────── Préférences & journal ───────────────────────── */

/** Colonnes visibles / taille de page mémorisées par utilisateur et par tableau. */
export const tablePreferences = pgTable(
  "table_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tableKey: varchar("table_key", { length: 64 }).notNull(),
    visibleColumns: text("visible_columns").array().notNull(),
    pageSize: smallint("page_size").notNull().default(25),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.tableKey] }),
    check("table_preferences_page_size_chk", sql`${t.pageSize} IN (25, 50, 100)`),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: uuid("actor_id").references(() => users.id),
    entity: varchar("entity", { length: 32 }).notNull(),
    entityId: text("entity_id").notNull(),
    action: varchar("action", { length: 32 }).notNull(),
    changes: jsonb("changes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_entity_idx").on(t.entity, t.entityId), index("audit_logs_actor_idx").on(t.actorId, t.createdAt)],
);

/* ─────────────────────────── CRM : deals / prospects ─────────────────────────── */

/** Un prospect suivi par un gestionnaire, et le type d'accord où il en est. */
export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Gestionnaire qui suit le deal (vide : suivi par l'administration) */
    managerId: uuid("manager_id").references(() => managers.id, { onDelete: "restrict" }),
    /** Client lié, s'il a un compte (prospect devenu client, appel d'un client existant…) */
    clientId: uuid("client_id").references(() => users.id, { onDelete: "restrict" }),
    type: dealTypeEnum("type").notNull().default("prospect"),
    prospectName: varchar("prospect_name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    email: varchar("email", { length: 255 }),
    city: varchar("city", { length: 120 }),
    source: dealSourceEnum("source").notNull().default("other"),
    carId: uuid("car_id").references(() => cars.id),
    promotionId: integer("promotion_id").references(() => promotions.id),
    reservationId: uuid("reservation_id").references(() => reservations.id),
    amount: numeric("amount", { precision: 10, scale: 2, mode: "number" }),
    expectedDate: date("expected_date", { mode: "string" }),
    nextFollowUp: date("next_follow_up", { mode: "string" }),
    /** Date et heure de l'échange avec le client */
    contactAt: timestamp("contact_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    /** Prochaine action prévue (ex. envoyer un devis) */
    nextAction: text("next_action"),
    notes: text("notes"),
    /** Dernier envoi du récapitulatif au client */
    sentToClientAt: timestamp("sent_to_client_at", { withTimezone: true, mode: "date" }),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("deals_manager_idx").on(t.managerId, t.updatedAt),
    index("deals_type_idx").on(t.type),
    index("deals_client_idx").on(t.clientId),
    check("deals_amount_chk", sql`${t.amount} IS NULL OR ${t.amount} >= 0`),
  ],
);

/** Suivi d'un deal : création, changement de type d'accord, notes. */
export const dealEvents = pgTable(
  "deal_events",
  {
    id: serial("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "restrict" }),
    fromType: dealTypeEnum("from_type"),
    toType: dealTypeEnum("to_type"),
    note: text("note"),
    actorId: uuid("actor_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("deal_events_deal_idx").on(t.dealId, t.createdAt), index("deal_events_actor_idx").on(t.actorId, t.createdAt)],
);

/* ─────────────────────────────── Relations ─────────────────────────────── */







export const managersRelations = relations(managers, ({ one, many }) => ({
  user: one(users, { fields: [managers.userId], references: [users.id] }),
  documents: many(managerDocuments),
  events: many(managerEvents),
  deals: many(deals),
  cars: many(carManagers),
}));

export const managerDocumentsRelations = relations(managerDocuments, ({ one }) => ({
  manager: one(managers, { fields: [managerDocuments.managerId], references: [managers.id] }),
}));

export const managerEventsRelations = relations(managerEvents, ({ one }) => ({
  manager: one(managers, { fields: [managerEvents.managerId], references: [managers.id] }),
  actor: one(users, { fields: [managerEvents.actorId], references: [users.id] }),
}));

export const agenciesRelations = relations(agencies, ({ many }) => ({
  cars: many(cars),
}));

export const carsRelations = relations(cars, ({ one, many }) => ({
  agency: one(agencies, { fields: [cars.agencyId], references: [agencies.id] }),
  images: many(carImages),
  translations: many(carTranslations),
  managers: many(carManagers),
  reservations: many(reservations),
}));

/** Gestionnaires associés à une voiture. Aucune ligne = tous les gestionnaires. */
/** Agences supplémentaires d'une voiture (0 ou plusieurs) ; l'agence principale reste cars.agency_id. */
export const carAgencies = pgTable(
  "car_agencies",
  {
    carId: uuid("car_id")
      .notNull()
      .references(() => cars.id, { onDelete: "restrict" }),
    agencyId: integer("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.carId, t.agencyId] }), index("car_agencies_agency_idx").on(t.agencyId)],
);

/** Responsables d'une voiture (0 ou plusieurs) : ils valident ses réservations. */
export const carResponsibles = pgTable(
  "car_responsibles",
  {
    carId: uuid("car_id")
      .notNull()
      .references(() => cars.id, { onDelete: "restrict" }),
    managerId: uuid("manager_id")
      .notNull()
      .references(() => managers.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.carId, t.managerId] }), index("car_responsibles_manager_idx").on(t.managerId)],
);

export const carManagers = pgTable(
  "car_managers",
  {
    carId: uuid("car_id")
      .notNull()
      .references(() => cars.id, { onDelete: "restrict" }),
    managerId: uuid("manager_id")
      .notNull()
      .references(() => managers.id, { onDelete: "restrict" }),
    /** manual = cochée à la main ; rule = ajoutée par la règle marque / ville du gestionnaire */
    source: varchar("source", { length: 16 }).notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.carId, t.managerId] }), index("car_managers_manager_idx").on(t.managerId)],
);

/** Informations personnelles de l'administrateur (même fiche que les gestionnaires, sans contrat ni pièces). */
export const adminProfiles = pgTable("admin_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "restrict" }),
  civility: civilityEnum("civility"),
  firstName: varchar("first_name", { length: 120 }),
  lastName: varchar("last_name", { length: 120 }),
  whatsapp: varchar("whatsapp", { length: 32 }),
  city: varchar("city", { length: 120 }),
  birthDate: date("birth_date", { mode: "string" }),
  maritalStatus: maritalStatusEnum("marital_status"),
  ...timestamps,
});

/**
 * Règle d'affectation d'un gestionnaire : marques et/ou villes (agence) choisies.
 * Les voitures actives qui correspondent lui sont affectées automatiquement, y compris
 * celles ajoutées plus tard ; une voiture désactivée est retirée. car_count = nombre de voitures affectées.
 */
export const managerCarRules = pgTable("manager_car_rules", {
  managerId: uuid("manager_id")
    .primaryKey()
    .references(() => managers.id, { onDelete: "restrict" }),
  brands: text("brands").array().notNull().default(sql`'{}'::text[]`),
  cities: text("cities").array().notNull().default(sql`'{}'::text[]`),
  /** Agences de rattachement choisies (identifiants) */
  agencies: integer("agencies").array().notNull().default(sql`'{}'::integer[]`),
  carCount: integer("car_count").notNull().default(0),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Agences d'un gestionnaire (en plus de l'agence dont il est le responsable). */
export const managerAgencies = pgTable(
  "manager_agencies",
  {
    managerId: uuid("manager_id")
      .notNull()
      .references(() => managers.id, { onDelete: "restrict" }),
    agencyId: integer("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "restrict" }),
    /** Responsable de l'agence (0, 1 ou plusieurs par agence) : valide les réservations */
    isResponsible: boolean("is_responsible").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.managerId, t.agencyId] }), index("manager_agencies_agency_idx").on(t.agencyId)],
);

/** Campagne d'email marketing : un code de réduction envoyé aux clients filtrés. */
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  message: text("message"),
  promotionId: integer("promotion_id")
    .notNull()
    .references(() => promotions.id),
  /** Filtres utilisés (villes, jours loués…) pour retrouver la cible */
  filters: jsonb("filters").$type<{ cities: string[]; minDays: number | null; maxDays: number | null; search?: string }>().notNull(),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Destinataires d'une campagne : le lien de l'email (jeton) attribue le code au client quand il clique. */
export const marketingRecipients = pgTable(
  "marketing_recipients",
  {
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => marketingCampaigns.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    token: varchar("token", { length: 64 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    failed: boolean("failed").notNull().default(false),
    clickedAt: timestamp("clicked_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.clientId] }), index("marketing_recipients_client_idx").on(t.clientId)],
);

/** Codes de réduction attribués à un client (au clic sur l'email de la campagne). */
export const clientPromotions = pgTable(
  "client_promotions",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    promotionId: integer("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "restrict" }),
    campaignId: integer("campaign_id").references(() => marketingCampaigns.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
    reservationId: uuid("reservation_id").references(() => reservations.id),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.promotionId] })],
);

/** Réglages modifiables par l'administrateur (sécurité…), une ligne par réglage. */
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

/** Modèles d'email modifiables depuis Administration (éditeur HTML). */
export const emailTemplates = pgTable(
  "email_templates",
  {
    key: varchar("key", { length: 64 }).notNull(),
    /** Un modèle par langue : le destinataire reçoit celui de sa langue */
    locale: localeEnum("locale").notNull().default("fr"),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.key, t.locale] })],
);

/** Fiche client gérée par l'équipe (complète le compte users de rôle "client"). */
export const clientProfiles = pgTable("client_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "restrict" }),
  civility: civilityEnum("civility"),
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }),
  city: varchar("city", { length: 120 }),
  birthDate: date("birth_date", { mode: "string" }),
  licenseNumber: varchar("license_number", { length: 64 }),
  licenseExpiresOn: date("license_expires_on", { mode: "string" }),
  notes: text("notes"),
  deactivationReason: text("deactivation_reason"),
  /** Liste noire : plus aucune réservation possible tant que le client y figure */
  blacklistedAt: timestamp("blacklisted_at", { withTimezone: true, mode: "date" }),
  blacklistedBy: uuid("blacklisted_by").references(() => users.id),
  blacklistReason: text("blacklist_reason"),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  ...timestamps,
});

/** Rendez-vous avec un client (agence, appel, livraison, essai…). */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedTo: uuid("assigned_to")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: appointmentKindEnum("kind").notNull().default("meeting"),
    status: appointmentStatusEnum("status").notNull().default("planned"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    durationMin: smallint("duration_min").notNull().default(30),
    agencyId: integer("agency_id").references(() => agencies.id),
    carId: uuid("car_id").references(() => cars.id),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("appointments_assigned_idx").on(t.assignedTo, t.startsAt),
    index("appointments_client_idx").on(t.clientId),
    check("appointments_duration_chk", sql`${t.durationMin} BETWEEN 5 AND 600`),
  ],
);

export const carManagersRelations = relations(carManagers, ({ one }) => ({
  car: one(cars, { fields: [carManagers.carId], references: [cars.id] }),
  manager: one(managers, { fields: [carManagers.managerId], references: [managers.id] }),
}));

export const carImagesRelations = relations(carImages, ({ one }) => ({
  car: one(cars, { fields: [carImages.carId], references: [cars.id] }),
}));

export const carTranslationsRelations = relations(carTranslations, ({ one }) => ({
  car: one(cars, { fields: [carTranslations.carId], references: [cars.id] }),
}));

export const promotionsRelations = relations(promotions, ({ many }) => ({
  reservations: many(reservations),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  manager: one(managers, { fields: [deals.managerId], references: [managers.id] }),
  client: one(users, { fields: [deals.clientId], references: [users.id] }),
  author: one(users, { fields: [deals.createdBy], references: [users.id] }),
  car: one(cars, { fields: [deals.carId], references: [cars.id] }),
  promotion: one(promotions, { fields: [deals.promotionId], references: [promotions.id] }),
  reservation: one(reservations, { fields: [deals.reservationId], references: [reservations.id] }),
  events: many(dealEvents),
}));

export const dealEventsRelations = relations(dealEvents, ({ one }) => ({
  deal: one(deals, { fields: [dealEvents.dealId], references: [deals.id] }),
  actor: one(users, { fields: [dealEvents.actorId], references: [users.id] }),
}));

/* ─────────────────────── Dossier voiture ─────────────────────── */

export const carRecordKindEnum = pgEnum("car_record_kind", ["insurance", "vignette", "oil_change", "technical_inspection", "expense"]);
export const expenseCategoryEnum = pgEnum("expense_category", ["maintenance", "repair", "tyres", "cleaning", "fuel", "parts", "fine", "other"]);

/**
 * Historique du dossier d'une voiture : assurance, vignette, vidange, visite technique et dépenses.
 * validUntil = échéance (fin d'assurance, prochaine vidange…) ; amount = coût, repris dans la rentabilité.
 */
export const carRecords = pgTable(
  "car_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carId: uuid("car_id")
      .notNull()
      .references(() => cars.id, { onDelete: "restrict" }),
    kind: carRecordKindEnum("kind").notNull(),
    category: expenseCategoryEnum("category"),
    performedOn: date("performed_on", { mode: "string" }).notNull(),
    validUntil: date("valid_until", { mode: "string" }),
    mileage: integer("mileage"),
    nextMileage: integer("next_mileage"),
    amount: numeric("amount", { precision: 10, scale: 2, mode: "number" }),
    provider: varchar("provider", { length: 160 }),
    reference: varchar("reference", { length: 120 }),
    notes: text("notes"),
    /** Annulé (saisie erronée) : reste dans l'historique, ignoré dans les calculs */
    voidedAt: timestamp("voided_at", { withTimezone: true, mode: "date" }),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("car_records_car_idx").on(t.carId, t.kind, t.performedOn),
    check("car_records_amount_chk", sql`${t.amount} IS NULL OR ${t.amount} >= 0`),
    check("car_records_dates_chk", sql`${t.validUntil} IS NULL OR ${t.validUntil} >= ${t.performedOn}`),
  ],
);

/** Documents d'une ligne du dossier (attestation d'assurance, carte grise, facture…), stockés en privé. */
export const carRecordFiles = pgTable(
  "car_record_files",
  {
    id: serial("id").primaryKey(),
    recordId: uuid("record_id")
      .notNull()
      .references(() => carRecords.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    publicId: text("public_id").notNull(),
    resourceType: varchar("resource_type", { length: 16 }).notNull().default("image"),
    format: varchar("format", { length: 16 }),
    bytes: integer("bytes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("car_record_files_record_idx").on(t.recordId)],
);

export const inspectionKindEnum = pgEnum("inspection_kind", ["departure", "return"]);

/** État des lieux au départ ou au retour : kilométrage, carburant, dégâts, photos, signature du client. */
export const carInspections = pgTable(
  "car_inspections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carId: uuid("car_id")
      .notNull()
      .references(() => cars.id, { onDelete: "restrict" }),
    reservationId: uuid("reservation_id").references(() => reservations.id, { onDelete: "restrict" }),
    kind: inspectionKindEnum("kind").notNull(),
    mileage: integer("mileage").notNull(),
    /** Carburant en huitièmes : 0 = vide, 8 = plein */
    fuelEighths: smallint("fuel_eighths").notNull(),
    damages: text("damages"),
    notes: text("notes"),
    signedByName: varchar("signed_by_name", { length: 160 }),
    signaturePublicId: text("signature_public_id"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("car_inspections_car_idx").on(t.carId, t.createdAt),
    index("car_inspections_reservation_idx").on(t.reservationId),
    check("car_inspections_fuel_chk", sql`${t.fuelEighths} BETWEEN 0 AND 8`),
    check("car_inspections_mileage_chk", sql`${t.mileage} >= 0`),
  ],
);

export const carInspectionPhotos = pgTable(
  "car_inspection_photos",
  {
    id: serial("id").primaryKey(),
    inspectionId: uuid("inspection_id")
      .notNull()
      .references(() => carInspections.id, { onDelete: "restrict" }),
    publicId: text("public_id").notNull(),
    resourceType: varchar("resource_type", { length: 16 }).notNull().default("image"),
    format: varchar("format", { length: 16 }),
    caption: varchar("caption", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("car_inspection_photos_idx").on(t.inspectionId)],
);

export type CarRecordKind = (typeof carRecordKindEnum.enumValues)[number];
export type ExpenseCategory = (typeof expenseCategoryEnum.enumValues)[number];

export const reservationsRelations = relations(reservations, ({ one, many }) => ({
  promotion: one(promotions, { fields: [reservations.promotionId], references: [promotions.id] }),
  car: one(cars, { fields: [reservations.carId], references: [cars.id] }),
  client: one(users, { fields: [reservations.clientId], references: [users.id], relationName: "client" }),
  handler: one(users, { fields: [reservations.handledBy], references: [users.id] }),
  pickupAgency: one(agencies, { fields: [reservations.pickupAgencyId], references: [agencies.id] }),
  returnAgency: one(agencies, { fields: [reservations.returnAgencyId], references: [agencies.id] }),
  extras: many(reservationExtras),
}));

export const reservationExtrasRelations = relations(reservationExtras, ({ one }) => ({
  reservation: one(reservations, {
    fields: [reservationExtras.reservationId],
    references: [reservations.id],
  }),
  extra: one(extras, { fields: [reservationExtras.extraId], references: [extras.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  manager: one(managers, { fields: [users.id], references: [managers.userId] }),
  accounts: many(accounts),
  reservations: many(reservations, { relationName: "client" }),
  clientProfile: one(clientProfiles, { fields: [users.id], references: [clientProfiles.userId] }),
}));

export const clientProfilesRelations = relations(clientProfiles, ({ one }) => ({
  user: one(users, { fields: [clientProfiles.userId], references: [users.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  client: one(users, { fields: [appointments.clientId], references: [users.id], relationName: "appointmentClient" }),
  assignee: one(users, { fields: [appointments.assignedTo], references: [users.id], relationName: "appointmentAssignee" }),
  agency: one(agencies, { fields: [appointments.agencyId], references: [agencies.id] }),
  car: one(cars, { fields: [appointments.carId], references: [cars.id] }),
}));

export type User = typeof users.$inferSelect;
export type Manager = typeof managers.$inferSelect;
export type Car = typeof cars.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type Agency = typeof agencies.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type ReservationStatus = (typeof reservationStatusEnum.enumValues)[number];
export type CarCategory = (typeof carCategoryEnum.enumValues)[number];
export type DocumentKind = (typeof documentKindEnum.enumValues)[number];
export type DealType = (typeof dealTypeEnum.enumValues)[number];
export type CarStatus = (typeof carStatusEnum.enumValues)[number];
export type AppointmentKind = (typeof appointmentKindEnum.enumValues)[number];
export type AppointmentStatus = (typeof appointmentStatusEnum.enumValues)[number];
export type DealSource = (typeof dealSourceEnum.enumValues)[number];
export type Promotion = typeof promotions.$inferSelect;
