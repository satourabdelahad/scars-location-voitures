import "server-only";

/**
 * reCAPTCHA v3 : vérification côté serveur du jeton envoyé par le formulaire.
 * Sans RECAPTCHA_SECRET_KEY (développement), la vérification est ignorée.
 * Score de 0 (robot) à 1 (humain) : refusé en dessous de RECAPTCHA_MIN_SCORE (0,5 par défaut).
 */
export async function verifyRecaptcha(token: unknown, action: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) return true;
  if (typeof token !== "string" || token.length < 20) return false;
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success: boolean; score?: number; action?: string; "error-codes"?: string[] };
    const min = Number(process.env.RECAPTCHA_MIN_SCORE ?? 0.5);
    const ok = data.success && (data.score ?? 0) >= min && (!data.action || data.action === action);
    if (!ok) console.warn("[recaptcha] refusé", { action, score: data.score, got: data.action, errors: data["error-codes"] });
    return ok;
  } catch (e) {
    // Google injoignable : on ne bloque pas les vrais utilisateurs.
    console.error("[recaptcha] vérification impossible", e);
    return true;
  }
}
