"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { alertSettingsSchema, contractSettingsSchema, saveAlertSettings, saveContractSettings } from "@/server/app-settings";
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
