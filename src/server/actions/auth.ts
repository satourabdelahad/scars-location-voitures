"use server";

import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { passwordTokens, users } from "@/db/schema";
import { sendPasswordReset } from "@/server/email";
import { hashToken, issuePasswordToken } from "@/server/tokens";
import { isLocale } from "@/i18n/config";

export type AuthFormState = { error?: string; ok?: boolean } | undefined;

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{10,200}$/;

export async function signOutAction() {
  const locale = await getLocale();
  await signOut({ redirectTo: `/${locale}` });
}

export async function loginAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const locale = await getLocale();
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
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
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

  await db.transaction(async (tx) => {
    await tx.update(passwordTokens).set({ usedAt: new Date() }).where(eq(passwordTokens.userId, row.userId));
    await tx
      .update(users)
      .set({ passwordHash: await bcrypt.hash(password, 12), emailVerified: new Date() })
      .where(eq(users.id, row.userId));
  });
  return { ok: true };
}
