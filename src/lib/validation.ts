import { z } from "zod";

/** Schémas partagés navigateur/serveur. Les messages sont des clés du namespace "Errors". */
export const PHONE_RE = /^\+?[0-9 ().-]{8,20}$/;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isoDate = z.string().regex(ISO_DATE_RE, "date");
const phone = z.string().trim().regex(PHONE_RE, "phone");
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
  contractType: z.enum(["freelance", "cdi"], { message: "required" }),
});
export type ManagerInput = z.infer<typeof managerSchema>;

export const LOCALE_CODES = ["fr", "ary", "ar", "en", "es", "de", "ja", "zh", "ko"] as const;

export const carSchema = z.object({
  agencyId: z.coerce.number().int().positive("required"),
  brand: required(80),
  model: required(80),
  year: z.coerce.number().int().min(1990, "number").max(2100, "number"),
  category: z.enum(["economy", "compact", "sedan", "suv", "luxury", "van", "convertible", "pickup"]),
  transmission: z.enum(["manual", "automatic"]),
  fuel: z.enum(["petrol", "diesel", "hybrid", "electric"]),
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
  })
  .refine((r) => r.endDate > r.startDate, { path: ["endDate"], message: "dateOrder" });
export type ReservationInput = z.infer<typeof reservationSchema>;
