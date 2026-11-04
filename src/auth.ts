import NextAuth, { type DefaultSession, CredentialsSignin } from "next-auth";
import type { Provider } from "next-auth/providers";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Twitter from "next-auth/providers/twitter";
import TikTok from "next-auth/providers/tiktok";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, auditLogs, sessions, users, verificationTokens, type Role } from "@/db/schema";
import {
  checkTotp,
  clearLoginFailures,
  clientIp,
  consumeRecoveryCode,
  isLoginLocked,
  loginKeys,
  looksLikeRecoveryCode,
  openSecret,
  recordLoginFailure,
} from "@/server/security";
import { getSecuritySettings, MAX_CLIENT_SESSION_DAYS } from "@/server/settings";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
}

class InvalidLogin extends CredentialsSignin {
  code = "invalid";
}
class AccountDisabled extends CredentialsSignin {
  code = "disabled";
}
class LoginLocked extends CredentialsSignin {
  code = "locked";
}
class TotpRequired extends CredentialsSignin {
  code = "totp_required";
}
class TotpInvalid extends CredentialsSignin {
  code = "totp_invalid";
}


/**
 * Instagram : l'ancienne "Basic Display API" a été fermée par Meta fin 2024.
 * On utilise "Instagram API with Instagram Login", réservée aux comptes Pro (Business / Creator).
 */
function InstagramLogin(clientId: string, clientSecret: string): Provider {
  return {
    id: "instagram",
    name: "Instagram",
    type: "oauth",
    clientId,
    clientSecret,
    authorization: {
      url: "https://www.instagram.com/oauth/authorize",
      params: { scope: "instagram_business_basic" },
    },
    token: "https://api.instagram.com/oauth/access_token",
    userinfo: "https://graph.instagram.com/me?fields=user_id,username,name,profile_picture_url",
    client: { token_endpoint_auth_method: "client_secret_post" },
    checks: ["state"],
    profile(profile: { user_id?: string; id?: string; username?: string; name?: string; profile_picture_url?: string }) {
      return {
        id: String(profile.user_id ?? profile.id),
        name: profile.name || profile.username || null,
        email: null,
        image: profile.profile_picture_url ?? null,
      };
    },
  };
}

/** Fournisseurs sociaux activés selon les variables d'environnement présentes. */
export const socialProviders = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  facebook: Boolean(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET),
  twitter: Boolean(process.env.AUTH_TWITTER_ID && process.env.AUTH_TWITTER_SECRET),
  tiktok: Boolean(process.env.AUTH_TIKTOK_ID && process.env.AUTH_TIKTOK_SECRET),
  instagram: Boolean(process.env.AUTH_INSTAGRAM_ID && process.env.AUTH_INSTAGRAM_SECRET),
} as const;
export type SocialProviderId = keyof typeof socialProviders;

const DUMMY_HASH = "$2b$12$ATwVEfNPtTA0fO2JYUoC2OguCtBigvAa0M2Fii6QPNNkt85uBNb.2";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
  code: z.string().trim().max(20).optional(),
});

const providers: Provider[] = [
  Credentials({
    id: "credentials",
    credentials: { email: {}, password: {}, code: {} },
    async authorize(raw, request) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) throw new InvalidLogin();
      // Contrôles faits ici (et pas seulement dans le formulaire) : l'URL de connexion d'Auth.js peut être appelée directement.
      const keys = loginKeys(parsed.data.email, clientIp(request.headers));
      if (await isLoginLocked(keys)) throw new LoginLocked();

      const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
      // Même durée de calcul que l'email existe ou non : on ne révèle pas quels comptes existent.
      const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH).then((v) => v && Boolean(user?.passwordHash));
      if (!user || !ok) {
        await recordLoginFailure(keys);
        throw new InvalidLogin();
      }
      if (user.status !== "active") throw new AccountDisabled();

      if (user.totpEnabledAt && user.totpSecret) {
        const code = parsed.data.code ?? "";
        if (!code) throw new TotpRequired();
        const step = checkTotp(openSecret(user.totpSecret), code, user.totpLastStep);
        if (step !== null) {
          await db.update(users).set({ totpLastStep: step }).where(eq(users.id, user.id));
        } else {
          const left = looksLikeRecoveryCode(code) ? consumeRecoveryCode(user.totpRecoveryCodes, code) : null;
          if (!left) {
            await recordLoginFailure(keys);
            throw new TotpInvalid();
          }
          await db.update(users).set({ totpRecoveryCodes: left }).where(eq(users.id, user.id));
          await db.insert(auditLogs).values({ actorId: user.id, entity: "session", entityId: user.id, action: "recovery_code", changes: { left: left.length } });
        }
      }

      await clearLoginFailures(keys);
      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];
if (socialProviders.google) providers.push(Google);
if (socialProviders.facebook) providers.push(Facebook);
if (socialProviders.twitter) providers.push(Twitter);
if (socialProviders.tiktok) providers.push(TikTok);
if (socialProviders.instagram)
  providers.push(InstagramLogin(process.env.AUTH_INSTAGRAM_ID!, process.env.AUTH_INSTAGRAM_SECRET!));

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // JWT obligatoire avec le fournisseur "credentials" ; le rôle et le statut sont relus en base à chaque requête.
  // Durée maximale du cookie ; la durée réelle (équipe / clients) est réglée dans Administration → Sécurité.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * MAX_CLIENT_SESSION_DAYS },
  pages: { signIn: "/fr/login", error: "/fr/login" },
  trustHost: true,
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (!user?.id || account?.provider === "credentials") return true;
      // Connexion sociale : réservée aux clients actifs. Le personnel se connecte par email + mot de passe.
      const [row] = await db
        .select({ status: users.status, role: users.role })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      if (!row) return true; // nouveau client, créé par l'adaptateur
      if (row.status !== "active") return "/fr/login?error=disabled";
      if (row.role !== "client") return "/fr/login?error=staff";
      return true;
    },
    async jwt({ token, user }) {
      const id = (user?.id ?? token.sub) as string | undefined;
      if (!id) return null;
      // Heure de connexion réelle (le jeton, lui, est réémis à chaque visite).
      if (user || typeof token.authAt !== "number") token.authAt = Date.now();
      const [row] = await db
        .select({ role: users.role, status: users.status, name: users.name, image: users.image, email: users.email })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      // Un compte désactivé est déconnecté immédiatement.
      if (!row || row.status !== "active") return null;
      // Durée de session : en heures pour l'équipe, en jours pour les clients.
      const sec = await getSecuritySettings();
      const limit = row.role === "client" ? sec.clientSessionDays * 86_400_000 : sec.staffSessionHours * 3_600_000;
      if (Date.now() - (token.authAt as number) > limit) return null;
      token.sub = id;
      token.role = row.role;
      token.name = row.name;
      token.picture = row.image;
      token.email = row.email;
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = (token.role as Role) ?? "client";
      return session;
    },
  },
  events: {
    // Connexions et déconnexions alimentent l'onglet "Historique" de la fiche gestionnaire.
    async signIn({ user, account }) {
      if (!user.id) return;
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      await db
        .insert(auditLogs)
        .values({ actorId: user.id, entity: "session", entityId: user.id, action: "login", changes: { provider: account?.provider ?? "credentials" } })
        .catch((e) => console.error("[auth] journal de connexion", e));
    },
    async signOut(message) {
      const userId = "token" in message ? message.token?.sub : "session" in message ? message.session?.userId : undefined;
      if (!userId) return;
      await db
        .insert(auditLogs)
        .values({ actorId: userId, entity: "session", entityId: userId, action: "logout" })
        .catch((e) => console.error("[auth] journal de déconnexion", e));
    },
  },
});
