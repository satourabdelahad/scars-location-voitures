import { isPossiblePhoneNumber } from "libphonenumber-js/min";
import { z } from "zod";
import { carCategoryEnum, fuelEnum, transmissionEnum } from "@/db/schema";

/** Schémas partagés navigateur/serveur. Les messages sont des clés du namespace "Errors". */
export const PHONE_RE = /^\+?[0-9 ().-]{8,20}$/;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isoDate = z.string().regex(ISO_DATE_RE, "date");
/** Numéro international (+212…) plausible pour le pays de son indicatif. */
const phone = z
  .string()
  .trim()
  .regex(PHONE_RE, "phone")
  .refine((v) => isPossiblePhoneNumber(v.startsWith("+") ? v : `+${v}`), "phone");
const required = (max = 120) => z.string().trim().min(1, "required").max(max);

function yearsBetween(birth: string, ref = new Date()) {
  const b = new Date(`${birth}T00:00:00Z`);
  let age = ref.getUTCFullYear() - b.getUTCFullYear();
  const m = ref.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export const managerSchema = z.object({
  civility: z.enum(["male", "female"], { message: "required" }),
  lastName: required(),
  firstName: required(),
  email: z.string().trim().toLowerCase().email("email"),
  phone,
  whatsapp: phone,
  city: required(),
  birthDate: isoDate.refine((d) => yearsBetween(d) >= 18, "minAge18"),
  maritalStatus: z.enum(["married", "widowed", "single"]).nullable().optional(),
  workStartDate: isoDate,
  contractType: z.enum(["cdi", "cdd", "freelance"], { message: "required" }),
});
export type ManagerInput = z.infer<typeof managerSchema>;

export const LOCALE_CODES = ["fr", "ary", "ar", "en", "es", "de", "ja", "zh", "ko"] as const;

export const carSchema = z.object({
  agencyId: z.coerce.number().int().positive("required"),
  brand: required(80),
  model: required(80),
  year: z.coerce.number().int().min(1990, "number").max(2100, "number"),
  category: z.enum(carCategoryEnum.enumValues, { message: "required" }),
  transmission: z.enum(transmissionEnum.enumValues, { message: "required" }),
  fuel: z.enum(fuelEnum.enumValues, { message: "required" }),
  seats: z.coerce.number().int().min(1, "number").max(20, "number"),
  doors: z.coerce.number().int().min(2, "number").max(6, "number"),
  luggage: z.coerce.number().int().min(0, "number").max(10, "number"),
  colorName: required(60),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "required"),
  plateNumber: z.string().trim().min(3, "required").max(32).transform((s) => s.toUpperCase()),
  vin: z
    .string()
    .trim()
    .max(17)
    .transform((s) => (s ? s.toUpperCase() : null))
    .nullable()
    .optional(),
  mileage: z.coerce.number().int().min(0, "number"),
  dailyPrice: z.coerce.number().positive("number"),
  deposit: z.coerce.number().min(0, "number"),
  airConditioning: z.boolean(),
  purchaseCity: required(120),
  purchaseDate: isoDate.refine((d) => d <= new Date().toISOString().slice(0, 10), "futureDate"),
  purchasePrice: z.coerce.number().positive("number"),
  descriptions: z.record(z.string(), z.string().max(2000)).refine((d) => (d.fr ?? "").trim().length > 0, "required"),
});
export type CarInput = z.infer<typeof carSchema>;

export const carDeactivationSchema = z.object({
  reason: z.enum(["stolen", "sold", "totaled", "accident", "end_of_lease", "other"]),
  note: z.string().trim().max(1000).optional(),
});

export const reservationSchema = z
  .object({
    carId: z.string().uuid(),
    startDate: isoDate,
    endDate: isoDate,
    pickupAgencyId: z.coerce.number().int().positive(),
    returnAgencyId: z.coerce.number().int().positive(),
    extras: z.array(z.coerce.number().int().positive()).max(10).default([]),
    driverFirstName: required(),
    driverLastName: required(),
    driverPhone: phone,
    driverLicenseNumber: required(64),
    driverBirthDate: isoDate.refine((d) => yearsBetween(d) >= 21, "minAge21"),
    flightNumber: z.string().trim().max(16).optional(),
    clientNote: z.string().trim().max(1000).optional(),
    promoCode: z.string().trim().max(32).optional(),
  })
  .refine((r) => r.endDate > r.startDate, { path: ["endDate"], message: "dateOrder" });
export type ReservationInput = z.infer<typeof reservationSchema>;

const emptyToNull = (v: unknown) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v);

/** Fiche client (créée ou modifiée par l'équipe). */
export const clientSchema = z.object({
  civility: z.preprocess(emptyToNull, z.enum(["male", "female"]).nullable()),
  firstName: required(),
  lastName: required(),
  email: z.preprocess(emptyToNull, z.string().trim().toLowerCase().email("email").nullable()),
  phone,
  whatsapp: z.preprocess(emptyToNull, phone.nullable()),
  city: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
  birthDate: z.preprocess(emptyToNull, isoDate.refine((d) => yearsBetween(d) >= 18, "minAge18").nullable()),
  licenseNumber: z.preprocess(emptyToNull, z.string().trim().max(64).nullable()),
  preferredLocale: z.enum(LOCALE_CODES).default("fr"),
  notes: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable()),
});
export type ClientInput = z.infer<typeof clientSchema>;

/** Agence : toutes les informations sont obligatoires (nom, ville, adresse, téléphones, responsable). */
export const agencySchema = z.object({
  name: z.string().trim().min(2, "required").max(160),
  city: z.string().trim().min(2, "required").max(120),
  address: z.string().trim().min(5, "required").max(500),
  phone,
  whatsapp: phone,
  isAirport: z.boolean().default(false),
  managerCivility: z.enum(["male", "female"], { error: "required" }),
  managerLastName: z.string().trim().min(1, "required").max(120),
  managerFirstName: z.string().trim().min(1, "required").max(120),
  managerEmail: z.string().trim().toLowerCase().email("email"),
  managerPhone: phone,
});
export type AgencyInput = z.infer<typeof agencySchema>;
