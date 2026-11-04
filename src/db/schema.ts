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
export const contractTypeEnum = pgEnum("contract_type", ["freelance", "cdi"]);
export const managerEventEnum = pgEnum("manager_event", ["created", "updated", "deactivated", "reactivated"]);
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
export const carStatusEnum = pgEnum("car_status", ["active", "deactivated"]);
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
export const dealTypeEnum = pgEnum("deal_type", ["prospect", "negotiation", "rental", "cancellation", "promotion"]);
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
    /** Double authentification (TOTP). Secrets chiffrés en AES-256-GCM avec une clé dérivée d'AUTH_SECRET. */
    totpSecret: text("totp_secret"),
    totpPendingSecret: text("totp_pending_secret"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true, mode: "date" }),
    /** Dernier pas de 30 s accepté : un même code ne peut pas servir deux fois. */
    totpLastStep: integer("totp_last_step"),
    /** Codes de secours (empreintes SHA-256), chacun utilisable une seule fois. */
    totpRecoveryCodes: jsonb("totp_recovery_codes").$type<string[]>(),
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
  isAirport: boolean("is_airport").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
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
    check("cars_purchase_price_chk", sql`${t.purchasePrice} IS NULL OR ${t.purchasePrice} >= 0`),
    check(
      "cars_deactivation_chk",
      sql`${t.status} = 'active' OR (${t.deactivationReason} IS NOT NULL AND ${t.deactivatedAt} IS NOT NULL)`,
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
    extrasTotal: numeric("extras_total", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
    promotionId: integer("promotion_id").references(() => promotions.id),
    discountAmount: numeric("discount_amount", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
    totalPrice: numeric("total_price", { precision: 10, scale: 2, mode: "number" }).notNull(),
    deposit: numeric("deposit", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
    status: reservationStatusEnum("status").notNull().default("pending"),
    driverFirstName: varchar("driver_first_name", { length: 120 }).notNull(),
    driverLastName: varchar("driver_last_name", { length: 120 }).notNull(),
    driverPhone: varchar("driver_phone", { length: 32 }).notNull(),
    driverLicenseNumber: varchar("driver_license_number", { length: 64 }).notNull(),
    driverBirthDate: date("driver_birth_date", { mode: "string" }).notNull(),
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
    managerId: uuid("manager_id")
      .notNull()
      .references(() => managers.id, { onDelete: "restrict" }),
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
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("deals_manager_idx").on(t.managerId, t.updatedAt),
    index("deals_type_idx").on(t.type),
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

export const usersRelations = relations(users, ({ one, many }) => ({
  manager: one(managers, { fields: [users.id], references: [managers.userId] }),
  accounts: many(accounts),
  reservations: many(reservations, { relationName: "client" }),
}));

export const managersRelations = relations(managers, ({ one, many }) => ({
  user: one(users, { fields: [managers.userId], references: [users.id] }),
  documents: many(managerDocuments),
  events: many(managerEvents),
  deals: many(deals),
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
  reservations: many(reservations),
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
  car: one(cars, { fields: [deals.carId], references: [cars.id] }),
  promotion: one(promotions, { fields: [deals.promotionId], references: [promotions.id] }),
  reservation: one(reservations, { fields: [deals.reservationId], references: [reservations.id] }),
  events: many(dealEvents),
}));

export const dealEventsRelations = relations(dealEvents, ({ one }) => ({
  deal: one(deals, { fields: [dealEvents.dealId], references: [deals.id] }),
  actor: one(users, { fields: [dealEvents.actorId], references: [users.id] }),
}));

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
export type DealSource = (typeof dealSourceEnum.enumValues)[number];
export type Promotion = typeof promotions.$inferSelect;
