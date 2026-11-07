/** Prix d'une location : suppléments par jour ou une seule fois, chauffeur par jour. */
export type PricedExtra = { price: number; pricing: "per_day" | "once"; qty?: number };

export function extraCost(x: PricedExtra, days: number) {
  return x.price * (x.qty ?? 1) * (x.pricing === "once" ? 1 : days);
}

export function extrasCost(list: PricedExtra[], days: number) {
  return list.reduce((s, x) => s + extraCost(x, days), 0);
}

/** Nom d'un supplément : celui saisi par l'administrateur, sinon la traduction du code. */
export function extraName(x: { name: string | null; code: string }, tx: { has: (k: string) => boolean; (k: string): string } | ((k: string) => string)) {
  if (x.name) return x.name;
  const t = tx as { has?: (k: string) => boolean; (k: string): string };
  return !t.has || t.has(x.code) ? t(x.code) : x.code;
}
