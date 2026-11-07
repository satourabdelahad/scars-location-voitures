/** Libellé neutre d'une promotion, identique dans toutes les langues : "ETE2026 (-15 %)". */
export function promotionLabel(promo: { code: string; kind: "percent" | "amount"; value: number }) {
  return promo.kind === "percent" ? `${promo.code} (-${promo.value} %)` : `${promo.code} (-${promo.value} MAD)`;
}
