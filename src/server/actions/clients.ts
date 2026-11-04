"use server";

import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, clientProfiles, users } from "@/db/schema";
import { clientSchema } from "@/lib/validation";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { searchClientsQuery, staffName, type ClientOption } from "@/server/queries/clients";
import { notifyClientInvite } from "@/server/notifications";
import { issuePasswordToken } from "@/server/tokens";

/** Envoie au client l'email d'invitation (choisir son mot de passe puis compléter sa fiche). */
async function inviteClient(clientId: string, actorId: string) {
  const token = await issuePasswordToken(clientId, "invite");
  const who = await staffName(actorId);
  return notifyClientInvite(clientId, token, who?.name ?? "Dizy Cars");
}

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

async function emailTaken(email: string | null, exceptId?: string) {
  if (!email) return false;
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return Boolean(u && u.id !== exceptId);
}

/**
 * Création d'un client par l'équipe. S'il a un email, il reçoit l'invitation (modèle "Invitation client") :
 * il choisit son mot de passe puis arrive sur « Mon profil » pour compléter ses informations.
 */
export async function createClient(input: unknown): Promise<ActionResult<{ id: string; name: string; email: string | null; phone: string | null; invited: boolean }>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const p = clientSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(p.error) };
    const d = p.data;
    if (await emailTaken(d.email)) return { ok: false, error: "unique:users_email_unique", fieldErrors: { email: "unique:users_email_unique" } };
    const name = `${d.firstName} ${d.lastName}`;
    const id = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ name, email: d.email, phone: d.phone, role: "client", preferredLocale: d.preferredLocale })
        .returning({ id: users.id });
      await tx.insert(clientProfiles).values({
        userId: u.id,
        civility: d.civility,
        firstName: d.firstName,
        lastName: d.lastName,
        whatsapp: d.whatsapp,
        city: d.city,
        birthDate: d.birthDate,
        licenseNumber: d.licenseNumber,
        notes: d.notes,
        createdBy: staff.id,
        updatedBy: staff.id,
      });
      await tx.insert(auditLogs).values({ actorId: staff.id, entity: "client", entityId: u.id, action: "create" });
      return u.id;
    });
    let invited = false;
    if (d.email) {
      const r = await inviteClient(id, staff.id).catch((e) => {
        console.error("[clients] invitation", e);
        return null;
      });
      invited = Boolean(r?.sent);
    }
    revalidatePath(`/${await getLocale()}`, "layout");
    return { ok: true, data: { id, name, email: d.email, phone: d.phone, invited } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateClient(id: string, input: unknown): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const p = clientSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(p.error) };
    const d = p.data;
    const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
    if (!u || u.role !== "client") return { ok: false, error: "not_found" };
    if (await emailTaken(d.email, id)) return { ok: false, error: "unique:users_email_unique", fieldErrors: { email: "unique:users_email_unique" } };
    const profile = {
      civility: d.civility,
      firstName: d.firstName,
      lastName: d.lastName,
      whatsapp: d.whatsapp,
      city: d.city,
      birthDate: d.birthDate,
      licenseNumber: d.licenseNumber,
      notes: d.notes,
      updatedBy: staff.id,
    };
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ name: `${d.firstName} ${d.lastName}`, email: d.email, phone: d.phone, preferredLocale: d.preferredLocale })
        .where(eq(users.id, id));
      await tx
        .insert(clientProfiles)
        .values({ userId: id, ...profile, createdBy: staff.id })
        .onConflictDoUpdate({ target: clientProfiles.userId, set: { ...profile, updatedAt: new Date() } });
      await tx.insert(auditLogs).values({ actorId: staff.id, entity: "client", entityId: id, action: "update", changes: d });
    });
    revalidatePath(`/${await getLocale()}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Renvoie l'invitation à un client qui n'a pas encore de compte (aucun mot de passe ni connexion Google). */
export async function resendClientInvite(id: string): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const u = await db.query.users.findFirst({ where: eq(users.id, id), columns: { role: true, email: true, passwordHash: true, status: true } });
    if (!u || u.role !== "client" || !u.email || u.passwordHash || u.status !== "active") return { ok: false, error: "invalid_transition" };
    const r = await inviteClient(id, staff.id);
    if (r.failed) return { ok: false, error: "email_failed" };
    if (r.skipped) return { ok: false, error: "email_not_configured" };
    await db.insert(auditLogs).values({ actorId: staff.id, entity: "client", entityId: id, action: "invite" });
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** On ne supprime jamais un client : on le désactive (motif obligatoire) ou on le réactive. */
export async function setClientStatus(id: string, status: "active" | "deactivated", reason?: string): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const r = z.string().trim().min(3).max(1000).safeParse(reason ?? "");
    if (status === "deactivated" && !r.success) return { ok: false, error: "validation", fieldErrors: { reason: "minLength" } };
    const [u] = await db.select({ role: users.role, name: users.name }).from(users).where(eq(users.id, id)).limit(1);
    if (!u || u.role !== "client") return { ok: false, error: "not_found" };
    const [first, ...last] = (u.name ?? "—").split(" ");
    await db.transaction(async (tx) => {
      await tx.update(users).set({ status }).where(eq(users.id, id));
      await tx
        .insert(clientProfiles)
        .values({ userId: id, firstName: first || "—", lastName: last.join(" ") || "—", deactivationReason: status === "deactivated" ? r.data : null, createdBy: staff.id })
        .onConflictDoUpdate({ target: clientProfiles.userId, set: { deactivationReason: status === "deactivated" ? r.data : null, updatedBy: staff.id, updatedAt: new Date() } });
      await tx.insert(auditLogs).values({ actorId: staff.id, entity: "client", entityId: id, action: status === "deactivated" ? "deactivate" : "reactivate", changes: status === "deactivated" ? { reason: r.data } : null });
    });
    revalidatePath(`/${await getLocale()}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Recherche de clients pour les formulaires (rendez-vous, deals). */
export async function searchClients(q: string): Promise<ClientOption[]> {
  await assertRole(["admin", "manager"]);
  if (q.trim().length < 2) return [];
  return searchClientsQuery(q);
}

