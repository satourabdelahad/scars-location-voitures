import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { promotions, type Promotion } from "@/db/schema";

/** Code promo valable pour une location commençant à `startDate` et durant `days` jours. */
export async function findApplicablePromotion(code: string, startDate: string, days: number): Promise<Promotion | null> {
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
  return promo;
}

/** Remise arrondie au dirham, jamais supérieure au montant de la location. */
export function computeDiscount(promo: Pick<Promotion, "kind" | "value">, subtotal: number) {
  const raw = promo.kind === "percent" ? (subtotal * promo.value) / 100 : promo.value;
  return Math.max(0, Math.min(subtotal, Math.round(raw)));
}

export { promotionLabel } from "@/lib/promotion-label";
