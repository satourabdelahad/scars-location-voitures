"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, clientDocumentKindEnum, clientDocuments, reservations } from "@/db/schema";
import { assertRole, toActionError, type ActionResult } from "@/server/guards";
import { assertReservationInScope } from "@/server/agency-scope";
import { documentViewUrl, verifyUpload } from "@/server/uploads";

/**
 * Le client dépose une pièce (permis ou carte d'identité, recto ou verso). La dernière déposée de chaque type est
 * celle qui compte ; les précédentes restent dans l'historique.
 */
export async function uploadClientDocument(input: unknown): Promise<ActionResult> {
  try {
    const user = await assertRole(["client"]);
    const p = z
      .object({
        kind: z.enum(clientDocumentKindEnum.enumValues),
        publicId: z.string().min(1).max(300),
        resourceType: z.enum(["image", "raw"]).default("image"),
        reservationId: z.string().uuid().nullable().default(null),
      })
      .safeParse(input);
    if (!p.success) return { ok: false, error: "validation" };
    if (p.data.reservationId) {
      const [r] = await db.select({ id: reservations.id }).from(reservations).where(and(eq(reservations.id, p.data.reservationId), eq(reservations.clientId, user.id))).limit(1);
      if (!r) return { ok: false, error: "not_found" };
    }
    const v = await verifyUpload(p.data.publicId, "document", p.data.resourceType);
    await db.insert(clientDocuments).values({ clientId: user.id, reservationId: p.data.reservationId, kind: p.data.kind, publicId: v.publicId, resourceType: p.data.resourceType, format: v.format, bytes: v.bytes });
    await db.insert(auditLogs).values({ actorId: user.id, entity: "client", entityId: user.id, action: "document_upload", changes: { kind: p.data.kind, reservationId: p.data.reservationId } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    if (["bad_type", "too_big", "cloudinary_not_configured"].includes(msg)) return { ok: false, error: msg };
    return toActionError(err);
  }
}

/** Lien temporaire vers une pièce : le client lui-même, ou l'équipe (dans son périmètre si la pièce est liée à une réservation). */
export async function clientDocumentUrl(id: number): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await assertRole(["client", "admin", "manager"]);
    const [d] = await db.select().from(clientDocuments).where(eq(clientDocuments.id, id)).limit(1);
    if (!d) return { ok: false, error: "not_found" };
    if (user.role === "client" && d.clientId !== user.id) return { ok: false, error: "not_found" };
    if (user.role === "manager" && d.reservationId) await assertReservationInScope(user, d.reservationId);
    const url = documentViewUrl(d.publicId, d.resourceType, d.format);
    if (!url) return { ok: false, error: "cloudinary_not_configured" };
    return { ok: true, data: { url } };
  } catch (err) {
    return toActionError(err);
  }
}
