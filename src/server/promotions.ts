import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientPromotions, promotions, type Promotion } from "@/db/schema";

/**
 * Code promo valable pour une location commençant à `startDate` et durant `days` jours.
 * Un code « réservé » (campagne d'email marketing) ne vaut que pour un client à qui il a été attribué
 * et qui ne l'a pas encore utilisé. `trustRestricted` : aperçu du prix avant identification.
 */
export async function findApplicablePromotion(
  code: string,
  startDate: string,
  days: number,
  clientId?: string | null,
  { trustRestricted = false }: { trustRestricted?: boolean } = {},
): Promise<Promotion | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const [promo] = await db
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.code, clean),
        eq(promotions.isActive, true),
        sql`(${promotions.startsOn} IS NULL OR ${promotions.startsOn} <= ${startDate}::date)`,
        sql`(${promotions.endsOn} IS NULL OR ${promotions.endsOn} >= ${startDate}::date)`,
      ),
    )
    .limit(1);
  if (!promo || days < promo.minDays) return null;
  if (promo.restricted && !trustRestricted) {
    if (!clientId) return null;
    const [own] = await db
      .select({ id: clientPromotions.promotionId })
      .from(clientPromotions)
      .where(and(eq(clientPromotions.clientId, clientId), eq(clientPromotions.promotionId, promo.id), isNull(clientPromotions.usedAt)))
      .limit(1);
    if (!own) return null;
  }
  return promo;
}

/** Codes attribués à un client et pas encore utilisés (proposés automatiquement à la réservation). */
export async function assignedPromotions(clientId: string) {
  return db
    .select({ code: promotions.code, kind: promotions.kind, value: promotions.value, endsOn: promotions.endsOn, minDays: promotions.minDays })
    .from(clientPromotions)
    .innerJoin(promotions, eq(promotions.id, clientPromotions.promotionId))
    .where(
      and(
        eq(clientPromotions.clientId, clientId),
        isNull(clientPromotions.usedAt),
        eq(promotions.isActive, true),
        sql`(${promotions.endsOn} IS NULL OR ${promotions.endsOn} >= CURRENT_DATE)`,
      ),
    )
    .orderBy(sql`${clientPromotions.assignedAt} DESC`);
}

/** Remise arrondie au dirham, jamais supérieure au montant de la location. */
export function computeDiscount(promo: Pick<Promotion, "kind" | "value">, subtotal: number) {
  const raw = promo.kind === "percent" ? (subtotal * promo.value) / 100 : promo.value;
  return Math.max(0, Math.min(subtotal, Math.round(raw)));
}

export { promotionLabel } from "@/lib/promotion-label";
