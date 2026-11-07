"use server";

import { casablancaToDate } from "@/lib/casablanca-time";
import { and, eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { appointmentKindEnum, appointments, appointmentStatusEnum, auditLogs, users } from "@/db/schema";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";

const schema = z.object({
  clientId: z.string().uuid("required"),
  kind: z.enum(appointmentKindEnum.enumValues),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "required"),
  durationMin: z.coerce.number().int().min(5, "number").max(600, "number"),
  agencyId: z.union([z.coerce.number().int().positive(), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  carId: z.string().uuid().or(z.literal("")).optional().transform((v) => v || null),
  assignedTo: z.string().uuid().or(z.literal("")).optional().transform((v) => v || null),
  notes: z.string().trim().max(2000).optional().transform((v) => v || null),
});

/** Date et heure saisies à l'heure du Maroc (Africa/Casablanca), converties en instant UTC. */
const toDate = casablancaToDate;

export async function createAppointment(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    const p = schema.safeParse(input);
    if (!p.success) return { ok: false, error: "validation", fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
    const d = p.data;
    // Un gestionnaire planifie pour lui-même ; l'administrateur peut confier le rendez-vous à un membre de l'équipe.
    const assignedTo = staff.role === "admin" && d.assignedTo ? d.assignedTo : staff.id;
    const [client] = await db.select({ role: users.role }).from(users).where(eq(users.id, d.clientId)).limit(1);
    if (client?.role !== "client") return { ok: false, error: "validation", fieldErrors: { clientId: "required" } };
    const [row] = await db
      .insert(appointments)
      .values({ clientId: d.clientId, assignedTo, kind: d.kind, startsAt: toDate(d.date, d.time), durationMin: d.durationMin, agencyId: d.agencyId, carId: d.carId, notes: d.notes, createdBy: staff.id })
      .returning({ id: appointments.id });
    await db.insert(auditLogs).values({ actorId: staff.id, entity: "appointment", entityId: row.id, action: "create", changes: { kind: d.kind, at: `${d.date} ${d.time}` } });
    revalidatePath(`/${await getLocale()}`, "layout");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return toActionError(err);
  }
}

/** Fait, annulé, absent… Les rendez-vous ne sont jamais supprimés. */
export async function setAppointmentStatus(id: string, status: (typeof appointmentStatusEnum.enumValues)[number]): Promise<ActionResult> {
  try {
    const staff = await assertRole(["admin", "manager"]);
    if (!appointmentStatusEnum.enumValues.includes(status)) return { ok: false, error: "validation" };
    const where = staff.role === "admin" ? eq(appointments.id, id) : and(eq(appointments.id, id), eq(appointments.assignedTo, staff.id));
    const [row] = await db.update(appointments).set({ status, updatedAt: new Date() }).where(where).returning({ id: appointments.id });
    if (!row) return { ok: false, error: "forbidden" };
    await db.insert(auditLogs).values({ actorId: staff.id, entity: "appointment", entityId: id, action: status });
    revalidatePath(`/${await getLocale()}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
