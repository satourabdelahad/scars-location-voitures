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
import { accounts, sessions, users, verificationTokens, type Role } from "@/db/schema";

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

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

const providers: Provider[] = [
  Credentials({
    id: "credentials",
    credentials: { email: {}, password: {} },
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) throw new InvalidLogin();
      const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
      if (!user?.passwordHash) throw new InvalidLogin();
      const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!ok) throw new InvalidLogin();
      if (user.status !== "active") throw new AccountDisabled();
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
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
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
      const [row] = await db
        .select({ role: users.role, status: users.status, name: users.name, image: users.image, email: users.email })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      // Un compte désactivé est déconnecté immédiatement.
      if (!row || row.status !== "active") return null;
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
    async signIn({ user }) {
      if (user.id) await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    },
  },
});
