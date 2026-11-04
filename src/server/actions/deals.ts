"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { dealEvents, deals } from "@/db/schema";
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
  phone: z.string().trim().regex(PHONE_RE, "phone"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("email")
    .or(z.literal(""))
    .optional()
    .transform((v) => v || null),
  city: optionalText(120),
  source: z.enum(["website", "phone", "whatsapp", "walk_in", "social", "referral", "other"]),
  type: z.enum(["prospect", "negotiation", "rental", "cancellation", "promotion"]),
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

/** Admin : tous les gestionnaires. Gestionnaire : uniquement ses propres deals. */
async function assertDealAccess(managerId: string) {
  const viewer = await assertRole(["admin", "manager"]);
  if (!(await canViewManager(viewer, managerId))) throw new ActionError("forbidden");
  return viewer;
}

export async function createDeal(managerId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const viewer = await assertDealAccess(managerId);
    const parsed = dealSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(deals)
        .values({ ...parsed.data, managerId, createdBy: viewer.id, updatedBy: viewer.id })
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
    const viewer = await assertDealAccess(current.managerId);
    const parsed = dealSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error.issues) };
    await db.transaction(async (tx) => {
      await tx.update(deals).set({ ...parsed.data, updatedBy: viewer.id }).where(eq(deals.id, dealId));
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
    const viewer = await assertDealAccess(current.managerId);
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
