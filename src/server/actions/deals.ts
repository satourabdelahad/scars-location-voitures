"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { dealEvents, deals, dealSourceEnum, dealTypeEnum, managers } from "@/db/schema";
import { isPossiblePhoneNumber } from "libphonenumber-js/min";
import { PHONE_RE } from "@/lib/validation";
import { ActionError, assertRole, toActionError, type ActionResult } from "@/server/guards";
import { canViewManager } from "@/server/queries/manager-profile";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date")
  .or(z.literal(""))
  .optional()
  .transform((v) => v || null);

const dealSchema = z.object({
  prospectName: z.string().trim().min(2, "required").max(160),
  phone: z.string().trim().regex(PHONE_RE, "phone").refine((v) => isPossiblePhoneNumber(v.startsWith("+") ? v : `+${v}`), "phone"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("email")
    .or(z.literal(""))
    .optional()
    .transform((v) => v || null),
  city: optionalText(120),
  source: z.enum(dealSourceEnum.enumValues),
  type: z.enum(dealTypeEnum.enumValues),
  clientId: z
    .string()
    .uuid()
    .or(z.literal(""))
    .optional()
    .nullable()
    .transform((v) => v || null),
  carId: z
    .string()
    .uuid()
    .or(z.literal(""))
    .optional()
    .transform((v) => v || null),
  promotionId: z.coerce
    .number()
    .int()
    .positive()
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  amount: z
    .union([z.coerce.number().min(0, "number"), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  expectedDate: optionalDate,
  nextFollowUp: optionalDate,
  notes: optionalText(4000),
});

function fieldErrors(issues: z.core.$ZodIssue[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/**
 * Admin : tous les deals. Gestionnaire : ses deals, et ceux qui ne sont suivis par personne
 * (ex. créés par l'administration sur une fiche client).
 */
async function assertDealAccess(deal: { managerId: string | null }) {
  const viewer = await assertRole(["admin", "manager"]);
  if (viewer.role === "admin" || deal.managerId === null) return viewer;
  if (!(await canViewManager(viewer, deal.managerId))) throw new ActionError("forbidden");
  return viewer;
}

async function ownManagerId(userId: string) {
  const [m] = await db.select({ id: managers.id }).from(managers).where(eq(managers.userId, userId)).limit(1);
  return m?.id ?? null;
}

/**
 * Nouveau deal. Depuis une fiche gestionnaire : scope.managerId. Depuis une fiche client : scope.clientId
 * (le deal est alors suivi par le gestionnaire connecté, ou par l'administration).
 */
export async function createDeal(scope: { managerId?: string | null; clientId?: string | null }, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const viewer = await assertRole(["admin", "manager"]);
    const managerId = scope.managerId ?? (viewer.role === "manager" ? await ownManagerId(viewer.id) : null);
    await assertDealAccess({ managerId });
    const parsed = dealSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
    const clientId = scope.clientId ?? parsed.data.clientId;
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(deals)
        .values({ ...parsed.data, clientId, managerId, createdBy: viewer.id, updatedBy: viewer.id })
        .returning({ id: deals.id });
      await tx.insert(dealEvents).values({ dealId: row.id, toType: parsed.data.type, actorId: viewer.id });
      return row.id;
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateDeal(dealId: string, input: unknown): Promise<ActionResult> {
  try {
    const [current] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!current) return { ok: false, error: "not_found" };
    const viewer = await assertDealAccess(current);
    const parsed = dealSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
    await db.transaction(async (tx) => {
      await tx.update(deals).set({ ...parsed.data, clientId: parsed.data.clientId ?? current.clientId, updatedBy: viewer.id }).where(eq(deals.id, dealId));
      if (parsed.data.type !== current.type) {
        await tx.insert(dealEvents).values({ dealId, fromType: current.type, toType: parsed.data.type, actorId: viewer.id });
      }
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addDealNote(dealId: string, note: string): Promise<ActionResult> {
  try {
    const clean = z.string().trim().min(2).max(2000).safeParse(note);
    if (!clean.success) return { ok: false, error: "validation", fieldErrors: { note: "minLength" } };
    const [current] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!current) return { ok: false, error: "not_found" };
    const viewer = await assertDealAccess(current);
    await db.transaction(async (tx) => {
      await tx.insert(dealEvents).values({ dealId, fromType: current.type, toType: current.type, note: clean.data, actorId: viewer.id });
      // Le deal remonte en haut de la liste.
      await tx.update(deals).set({ updatedBy: viewer.id }).where(eq(deals.id, dealId));
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
