import "server-only";

/**
 * reCAPTCHA v3 : vérification côté serveur du jeton envoyé par le formulaire.
 * Clés : RECAPTCHA_KEY (clé du site) et RECAPTCHA_SECRET (clé secrète).
 * Sans ces clés (développement), la vérification est ignorée.
 * Score de 0 (robot) à 1 (humain) : refusé en dessous de RECAPTCHA_MIN_SCORE (0,5 par défaut).
 */
export async function verifyRecaptcha(token: unknown, action: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET || process.env.RECAPTCHA_SECRET_KEY;
  if (!secret || !(process.env.RECAPTCHA_KEY || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY)) return true;
  if (typeof token !== "string" || token.length < 20) {
    // Le navigateur n'a pas produit de jeton : clé du site absente du build (serveur à redémarrer
    // après une modification de .env), clé v2 au lieu de v3, ou domaine non autorisé dans la console reCAPTCHA.
    console.warn(`[recaptcha] refusé (${action}) : aucun jeton reçu du navigateur. Vérifiez que RECAPTCHA_KEY est une clé v3, que le domaine est autorisé, puis redémarrez le serveur.`);
    return false;
  }
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success: boolean; score?: number; action?: string; hostname?: string; "error-codes"?: string[] };
    const errors = data["error-codes"] ?? [];
    // Clé secrète invalide : c'est une erreur de configuration, pas un robot. On laisse passer et on le signale.
    if (errors.includes("invalid-input-secret") || errors.includes("missing-input-secret")) {
      console.error("[recaptcha] RECAPTCHA_SECRET refusée par Google : vérifiez qu'elle correspond à RECAPTCHA_KEY (même site, version v3).");
      return true;
    }
    const min = Number(process.env.RECAPTCHA_MIN_SCORE ?? 0.5);
    const ok = data.success && (data.score ?? 0) >= min && (!data.action || data.action === action);
    if (!ok)
      console.warn("[recaptcha] refusé", {
        action,
        score: data.score,
        minimum: min,
        actionRecue: data.action,
        domaine: data.hostname,
        erreurs: errors,
        aide: errors.includes("invalid-input-response")
          ? "jeton invalide : la clé du site (RECAPTCHA_KEY) ne correspond pas à la clé secrète, ou ce n'est pas une clé v3"
          : errors.includes("timeout-or-duplicate")
            ? "jeton expiré ou déjà utilisé : rechargez la page"
            : (data.score ?? 0) < min
              ? "score trop bas (fréquent en local) : baissez RECAPTCHA_MIN_SCORE, par exemple 0.3"
              : undefined,
      });
    return ok;
  } catch (e) {
    // Google injoignable : on ne bloque pas les vrais utilisateurs.
    console.error("[recaptcha] vérification impossible", e);
    return true;
  }
}
