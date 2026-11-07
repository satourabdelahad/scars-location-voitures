"use server";

import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { unlockAccount } from "@/server/security";
import { saveSecuritySettings, securitySettingsSchema } from "@/server/settings";

function issues(err: { issues: { path: PropertyKey[]; message: string }[] }) {
  return Object.fromEntries(err.issues.map((i) => [String(i.path[0]), i.message]));
}

export async function updateSecuritySettings(input: unknown): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const parsed = securitySettingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation", fieldErrors: issues(parsed.error) };
    await saveSecuritySettings(parsed.data, admin.id);
    await db.insert(auditLogs).values({ actorId: admin.id, entity: "security", entityId: "settings", action: "settings_update", changes: parsed.data });
    revalidatePath(`/${await getLocale()}/admin/security`);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Débloque un compte (gestionnaire, client ou administrateur) bloqué après trop d'échecs de connexion. */
export async function unlockUser(userId: string): Promise<ActionResult> {
  try {
    const admin = await assertRole(["admin"]);
    const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (!u?.email) return { ok: false, error: "not_found" };
    await unlockAccount(u.email);
    await db.insert(auditLogs).values({ actorId: admin.id, entity: "security", entityId: userId, action: "unlock" });
    revalidatePath(`/${await getLocale()}/admin`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
