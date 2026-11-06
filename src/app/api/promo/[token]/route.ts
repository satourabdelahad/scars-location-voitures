import { and, eq, isNull } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { clientPromotions, marketingCampaigns, marketingRecipients, promotions } from "@/db/schema";
import { isLocale } from "@/i18n/config";
import { PROMO_COOKIE } from "@/lib/promo-cookie";

/**
 * Bouton de l'email marketing : attribue le code de réduction au client (une seule fois),
 * le garde dans un cookie pour la réservation, puis ouvre le parc avec le code affiché.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/promo/[token]">) {
  const { token } = await ctx.params;
  const l = req.nextUrl.searchParams.get("l") ?? "fr";
  const locale = isLocale(l) ? l : "fr";
  const base = new URL(`/${locale}/cars`, req.nextUrl.origin);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return NextResponse.redirect(base);

  const [r] = await db
    .select({ campaignId: marketingRecipients.campaignId, clientId: marketingRecipients.clientId, promotionId: promotions.id, code: promotions.code, active: promotions.isActive })
    .from(marketingRecipients)
    .innerJoin(marketingCampaigns, eq(marketingCampaigns.id, marketingRecipients.campaignId))
    .innerJoin(promotions, eq(promotions.id, marketingCampaigns.promotionId))
    .where(eq(marketingRecipients.token, token))
    .limit(1);
  if (!r) return NextResponse.redirect(base);

  await db
    .update(marketingRecipients)
    .set({ clickedAt: new Date() })
    .where(and(eq(marketingRecipients.token, token), isNull(marketingRecipients.clickedAt)));
  await db.insert(clientPromotions).values({ clientId: r.clientId, promotionId: r.promotionId, campaignId: r.campaignId }).onConflictDoNothing();

  base.searchParams.set("promo", r.code);
  const res = NextResponse.redirect(base);
  res.cookies.set(PROMO_COOKIE, r.code, { maxAge: 60 * 60 * 24 * 60, httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/" });
  return res;
}
