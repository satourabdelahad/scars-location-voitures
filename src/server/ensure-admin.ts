import { eq } from "drizzle-orm";
import { db } from "@/db";
import { managers, users } from "@/db/schema";

/**
 * Au démarrage : le super administrateur est le compte de SEED_ADMIN_EMAIL.
 * S'il n'existe pas, il est créé sans mot de passe ; à la première connexion, il clique sur
 * « Mot de passe oublié » et choisit son mot de passe par email. Un compte existant n'est jamais modifié.
 */
export async function ensureSuperAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !process.env.DATABASE_URL) return;
  try {
    let [admin] = await db.select({ id: users.id, role: users.role, phone: users.phone }).from(users).where(eq(users.email, email)).limit(1);
    if (!admin) {
      [admin] = await db
        .insert(users)
        .values({ name: "Administrateur", email, role: "admin", status: "active", emailVerified: new Date() })
        .onConflictDoNothing()
        .returning({ id: users.id, role: users.role, phone: users.phone });
      if (admin) console.info(`[admin] super administrateur créé : ${email} (première connexion : « Mot de passe oublié »)`);
    } else if (admin.role !== "admin") {
      console.warn(`[admin] ${email} existe déjà avec le rôle « ${admin.role} » : il n'a pas été modifié.`);
      return;
    }
    if (!admin) return;
    // Sa fiche gestionnaire (listes, responsable d'agence, voitures suivies).
    await db
      .insert(managers)
      .values({
        userId: admin.id,
        civility: "male",
        lastName: "Administrateur",
        firstName: "Admin",
        phone: admin.phone ?? "",
        whatsapp: admin.phone ?? "",
        city: "",
        birthDate: "1990-01-01",
        workStartDate: new Date().toISOString().slice(0, 10),
        contractType: "cdi",
      })
      .onConflictDoNothing();
  } catch (e) {
    // Base pas encore migrée ou injoignable : l'application démarre quand même.
    console.error("[admin] vérification du super administrateur impossible", e instanceof Error ? e.message : e);
  }
}
