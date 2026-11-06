/** Promotion d'une voiture (remise en % sur le prix par jour), partagée navigateur / serveur. */
export type CarPromo = { promoPercent: number | null; promoStartsOn: string | null; promoEndsOn: string | null };

/** Pourcentage applicable à la date donnée (AAAA-MM-JJ), ou null si la promotion n'est pas en cours. */
export function activePromoPercent(car: CarPromo, on: string): number | null {
  if (!car.promoPercent) return null;
  if (car.promoStartsOn && on < car.promoStartsOn) return null;
  if (car.promoEndsOn && on > car.promoEndsOn) return null;
  return car.promoPercent;
}

/** Prix par jour remisé, arrondi au dirham. */
export function promoPrice(dailyPrice: number, percent: number | null) {
  return percent ? Math.round(dailyPrice * (1 - percent / 100)) : dailyPrice;
}

/** État affiché dans le back-office : en cours, à venir, terminée, aucune. */
export function promoState(car: CarPromo, today: string): "none" | "active" | "scheduled" | "ended" {
  if (!car.promoPercent) return "none";
  if (car.promoEndsOn && today > car.promoEndsOn) return "ended";
  if (car.promoStartsOn && today < car.promoStartsOn) return "scheduled";
  return "active";
}
