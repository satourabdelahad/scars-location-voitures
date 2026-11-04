"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { managerEvents, managers, users } from "@/db/schema";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { resolvePhoto } from "@/server/photo";
import { PHONE_RE } from "@/lib/validation";

const phone = z.string().trim().regex(PHONE_RE, "phone");
const optionalPhone = z
  .string()
  .trim()
  .transform((s) => s || null)
  .refine((s) => s === null || PHONE_RE.test(s), "phone")
  .nullable();

const staffOrClientSchema = z.object({
  name: z.string().trim().min(2, "required").max(120),
  email: z.string().trim().toLowerCase().email("email"),
  phone: optionalPhone,
});
const clientSchema = staffOrClientSchema.omit({ email: true });
/** Le gestionnaire modifie ses coordonnées ; identité, contrat et pièces restent gérés par l'administrateur. */
const managerSelfSchema = z.object({
  phone,
  whatsapp: phone,
  city: z.string().trim().min(1, "required").max(120),
  maritalStatus: z.enum(["married", "widowed", "single"]).nullable(),
});

function fieldErrors(err: z.ZodError) {
  return Object.fromEntries(err.issues.map((i) => [String(i.path[0]), i.message]));
}

/** "Mon profil" : chacun modifie ses propres informations. */
export async function updateMyProfile(input: { data: unknown; photo?: unknown }): Promise<ActionResult> {
  try {
    const me = await assertRole(["admin", "manager", "client"]);
    const locale = await getLocale();
    const photo = await resolvePhoto(input.photo);

    if (me.role === "manager") {
      const parsed = managerSelfSchema.safeParse(input.data);
      if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error) };
      const [m] = await db.select().from(managers).where(eq(managers.userId, me.id)).limit(1);
      if (!m) return { ok: false, error: "not_found" };
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const k of ["phone", "whatsapp", "city", "maritalStatus"] as const)
        if ((m[k] ?? null) !== (parsed.data[k] ?? null)) changes[k] = { from: m[k], to: parsed.data[k] };
      if (photo && photo.photoPublicId !== m.photoPublicId) changes.photo = { from: m.photoPublicId ? "…" : null, to: photo.photoPublicId ? "new" : null };
      await db.transaction(async (tx) => {
        await tx.update(managers).set({ ...parsed.data, ...(photo ?? {}) }).where(eq(managers.id, m.id));
        await tx.update(users).set({ phone: parsed.data.phone, ...(photo ? { image: photo.photoUrl } : {}) }).where(eq(users.id, me.id));
        if (Object.keys(changes).length) await tx.insert(managerEvents).values({ managerId: m.id, event: "updated", changes, actorId: me.id });
      });
    } else {
      const parsed = (me.role === "admin" ? staffOrClientSchema : clientSchema).safeParse(input.data);
      if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrors(parsed.error) };
      const d = parsed.data as { name: string; phone: string | null; email?: string };
      if (d.email) {
        const [other] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
        if (other && other.id !== me.id) return { ok: false, error: "unique:users_email_unique", fieldErrors: { email: "unique:users_email_unique" } };
      }
      await db
        .update(users)
        .set({ name: d.name, phone: d.phone, ...(d.email ? { email: d.email } : {}), ...(photo ? { image: photo.photoUrl } : {}) })
        .where(eq(users.id, me.id));
    }
    revalidatePath(`/${locale}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{10,200}$/;

/** Changement de mot de passe : l'actuel est exigé s'il existe (un client inscrit via Google peut en créer un). */
export async function changeMyPassword(input: { current: string; next: string; confirm: string }): Promise<ActionResult> {
  try {
    const me = await assertRole(["admin", "manager", "client"]);
    const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id)).limit(1);
    if (u?.hash && !(await bcrypt.compare(input.current ?? "", u.hash)))
      return { ok: false, error: "validation", fieldErrors: { current: "passwordWrong" } };
    if (!PASSWORD_RE.test(input.next ?? "")) return { ok: false, error: "validation", fieldErrors: { next: "passwordWeak" } };
    if (input.next !== input.confirm) return { ok: false, error: "validation", fieldErrors: { confirm: "passwordMismatch" } };
    await db.update(users).set({ passwordHash: await bcrypt.hash(input.next, 12) }).where(eq(users.id, me.id));
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
