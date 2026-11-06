/** Exécuté une fois au démarrage du serveur (et à chaque démarrage à froid sur Netlify). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureSuperAdmin } = await import("@/server/ensure-admin");
  await ensureSuperAdmin();
}
