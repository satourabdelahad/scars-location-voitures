"use server";

import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { managerEvents, managers, passwordTokens, users } from "@/db/schema";
import { INVITATION_PENDING } from "@/lib/manager-status";
import { sendPasswordReset } from "@/server/email";
import { hashToken, issuePasswordToken } from "@/server/tokens";
import { isLocale } from "@/i18n/config";
import { verifyRecaptcha } from "@/server/recaptcha";

export type AuthFormState = { error?: string; ok?: boolean } | undefined;

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{10,200}$/;

/** Déconnexion : retour à la page d'accueil publique, dans la langue en cours. */
export async function signOutAction() {
  const locale = await getLocale();
  await signOut({ redirectTo: `/${locale}` });
}

export async function loginAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const locale = await getLocale();
  // Le code de double authentification (2e étape) n'a pas besoin d'un nouveau contrôle anti-robot.
  if (!form.get("code") && !(await verifyRecaptcha(form.get("recaptcha"), "login"))) return { error: "captcha" };
  const callbackUrl = String(form.get("callbackUrl") || "");
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      code: String(form.get("code") ?? ""),
      redirectTo: callbackUrl.startsWith(`/${locale}/`) ? callbackUrl : `/${locale}/after-login`,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      // Seule une vraie erreur d'identifiants s'affiche "email ou mot de passe incorrect".
      if (err.type === "CredentialsSignin") {
        const code = (err as AuthError & { code?: string }).code ?? "";
        return { error: ["disabled", "locked", "totp_required", "totp_invalid"].includes(code) ? code : "invalid" };
      }
      // Base inaccessible, AUTH_SECRET manquant… : on le dit clairement et on détaille dans le terminal.
      console.error("[auth] Échec de connexion côté serveur :", err.type, err.cause ?? err.message);
      return { error: "server" };
    }
    throw err; // redirection Next.js
  }
}

export async function socialLoginAction(provider: string, callbackUrl?: string) {
  const locale = await getLocale();
  await signIn(provider, { redirectTo: callbackUrl?.startsWith(`/${locale}/`) ? callbackUrl : `/${locale}/after-login` });
}

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().regex(PASSWORD_RE),
});

export async function registerAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const locale = await getLocale();
  if (!(await verifyRecaptcha(form.get("recaptcha"), "register"))) return { error: "captcha" };
  const parsed = registerSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) {
    const pw = parsed.error.issues.some((i) => i.path[0] === "password");
    return { error: pw ? "passwordWeak" : "generic" };
  }
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (exists) return { error: "emailTaken" };
  await db.insert(users).values({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await bcrypt.hash(parsed.data.password, 12),
    role: "client",
    preferredLocale: isLocale(locale) ? locale : "fr",
  });
  const callbackUrl = String(form.get("callbackUrl") || "");
  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: callbackUrl.startsWith(`/${locale}/`) ? callbackUrl : `/${locale}/account`,
  });
}

export async function forgotPasswordAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const locale = await getLocale();
  if (!(await verifyRecaptcha(form.get("recaptcha"), "forgot_password"))) return { error: "captcha" };
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (email.success) {
    const [user] = await db
      .select({ id: users.id, status: users.status, hash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email.data))
      .limit(1);
    if (user && user.status === "active") {
      const token = await issuePasswordToken(user.id, "reset");
      await sendPasswordReset({ to: email.data, token, locale });
    }
  }
  // Réponse identique dans tous les cas, pour ne pas révéler l'existence d'un compte.
  return { ok: true };
}

export async function setPasswordAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const token = String(form.get("token") || "");
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirm") || "");
  if (password !== confirm) return { error: "passwordMismatch" };
  if (!PASSWORD_RE.test(password)) return { error: "passwordWeak" };

  const [row] = await db
    .select({ id: passwordTokens.id, userId: passwordTokens.userId })
    .from(passwordTokens)
    .where(
      and(eq(passwordTokens.tokenHash, hashToken(token)), isNull(passwordTokens.usedAt), gt(passwordTokens.expiresAt, new Date())),
    )
    .limit(1);
  if (!row) return { error: "tokenInvalid" };

  const hash = await bcrypt.hash(password, 12);
  const [u] = await db.select({ email: users.email, role: users.role }).from(users).where(eq(users.id, row.userId)).limit(1);
  await db.transaction(async (tx) => {
    await tx.update(passwordTokens).set({ usedAt: new Date() }).where(eq(passwordTokens.userId, row.userId));
    await tx.update(users).set({ passwordHash: hash, emailVerified: new Date() }).where(eq(users.id, row.userId));
    // Premier clic sur l'invitation : le gestionnaire en attente devient actif.
    const [activated] = await tx
      .update(managers)
      .set({ status: "active", deactivationReason: null, deactivatedAt: null })
      .where(and(eq(managers.userId, row.userId), eq(managers.status, "deactivated"), eq(managers.deactivationReason, INVITATION_PENDING)))
      .returning({ id: managers.id });
    if (activated) {
      await tx.update(users).set({ status: "active" }).where(eq(users.id, row.userId));
      await tx.insert(managerEvents).values({ managerId: activated.id, event: "activated", actorId: row.userId });
    }
  });
  // Connexion directe, puis ouverture de « Mon profil » pour compléter ses informations.
  const locale = await getLocale();
  if (u?.email) {
    const target = u.role === "client" ? `/${locale}/account/profile?welcome=1` : u.role === "manager" ? `/${locale}/manager/profile?edit=1` : `/${locale}/after-login`;
    try {
      await signIn("credentials", { email: u.email, password, redirectTo: target });
    } catch (err) {
      // Double authentification exigée ou compte bloqué : il se connectera depuis la page de connexion.
      if (err instanceof AuthError) return { ok: true };
      throw err; // redirection Next.js
    }
  }
  return { ok: true };
}

/**
 * Connexion par email et mot de passe au moment de réserver, sans quitter la page : la réservation est ensuite
 * envoyée avec la session ouverte.
 */
export async function bookingLoginAction(email: string, password: string, recaptcha?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await verifyRecaptcha(recaptcha, "login"))) return { ok: false, error: "captcha" };
  try {
    await signIn("credentials", { email, password, code: "", redirect: false });
    const session = await auth();
    if (session?.user?.role && session.user.role !== "client") return { ok: false, error: "staff" };
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError && err.type === "CredentialsSignin") {
      const code = (err as AuthError & { code?: string }).code ?? "";
      return { ok: false, error: ["disabled", "locked", "totp_required"].includes(code) ? code : "invalid" };
    }
    console.error("[auth] connexion pendant la réservation", err);
    return { ok: false, error: "server" };
  }
}
