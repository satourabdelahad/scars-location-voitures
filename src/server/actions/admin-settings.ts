"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, extras } from "@/db/schema";
import { alertSettingsSchema, bookingSettingsSchema, contractSettingsSchema, saveAlertSettings, saveBookingSettings, saveContractSettings } from "@/server/app-settings";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";

/** Administration → Contrat : en-tête, corps et logo du contrat de location. */
export async function updateContractSettings(input: unknown): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const p = contractSettingsSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation" };
    await saveContractSettings(p.data, admin.id);
    await db.insert(auditLogs).values({ actorId: admin.id, entity: "contract", entityId: "template", action: "update" });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Seuils des alertes (assurance, vignette, vidange, visite technique, voiture disponible). */
export async function updateAlertSettings(input: unknown): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const p = alertSettingsSchema.safeParse(input);
    if (!p.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of p.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      return { ok: false, error: "validation", fieldErrors };
    }
    await saveAlertSettings(p.data, admin.id);
    await db.insert(auditLogs).values({ actorId: admin.id, entity: "alerts", entityId: "settings", action: "update", changes: p.data });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

const extraRowSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2, "required").max(160),
  price: z.coerce.number().min(0, "number").max(100000, "number"),
  pricing: z.enum(["per_day", "once"]),
  isActive: z.boolean(),
});

/**
 * Administration → Suppléments : nom, prix, par jour ou une fois, actif ou non (jamais supprimés),
 * et prix du chauffeur par jour. L'ordre de la liste est l'ordre d'affichage.
 */
export async function saveExtras(rows: unknown, booking: unknown): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const list = z.array(extraRowSchema).max(50).safeParse(rows);
    const b = bookingSettingsSchema.safeParse(booking);
    if (!list.success || !b.success) return { ok: false, error: "validation" };
    await db.transaction(async (tx) => {
      for (const [i, x] of list.data.entries()) {
        const values = { name: x.name, pricePerDay: x.price, pricing: x.pricing, isActive: x.isActive, sortOrder: i };
        if (x.id) await tx.update(extras).set(values).where(eq(extras.id, x.id));
        else await tx.insert(extras).values({ ...values, code: `x_${randomBytes(5).toString("hex")}` });
      }
      await tx.insert(auditLogs).values({ actorId: admin.id, entity: "extras", entityId: "all", action: "update", changes: { extras: list.data, booking: b.data } });
    });
    await saveBookingSettings(b.data, admin.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
