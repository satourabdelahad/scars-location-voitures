import "server-only";
import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import type { Role } from "@/db/schema";

export type SessionUser = { id: string; role: Role; name?: string | null; email?: string | null; image?: string | null };

/** Pour les pages : redirige vers la connexion (ou l'espace adapté) si le rôle ne convient pas. */
export async function requireRole(roles: Role[], callbackPath?: string): Promise<SessionUser> {
  const session = await auth();
  const locale = await getLocale();
  if (!session?.user) {
    const query = callbackPath ? `?callbackUrl=${encodeURIComponent(`/${locale}${callbackPath}`)}` : "";
    return redirect({ href: `/login${query}`, locale });
  }
  if (!roles.includes(session.user.role)) {
    return redirect({ href: homeForRole(session.user.role), locale });
  }
  return session.user as SessionUser;
}

export function homeForRole(role: Role) {
  return role === "admin" ? "/admin" : role === "manager" ? "/manager" : "/account";
}

export class ActionError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Pour les actions serveur : lève une erreur si l'utilisateur n'a pas le bon rôle. */
export async function assertRole(roles: Role[]): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new ActionError("unauthenticated");
  if (!roles.includes(session.user.role)) throw new ActionError("forbidden");
  return session.user as SessionUser;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Traduit les erreurs PostgreSQL de nos règles métier en codes compréhensibles par l'interface. */
export function toActionError(err: unknown): { ok: false; error: string } {
  if (err instanceof ActionError) return { ok: false, error: err.code };
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = e?.code ?? e?.cause?.code;
  const constraint = e?.constraint ?? e?.cause?.constraint;
  if (code === "23505") return { ok: false, error: constraint ? `unique:${constraint}` : "unique" };
  if (code === "23P01") return { ok: false, error: "overlap" };
  if (code === "P0001") return { ok: false, error: "delete_forbidden" };
  if (code === "P0002") return { ok: false, error: "car_frozen" };
  if (code === "P0003") return { ok: false, error: "car_unavailable" };
  console.error(err);
  return { ok: false, error: "unknown" };
}

/** « Hicham (Administrateur) » : auteur d'une action, tel qu'il apparaît dans les emails. */
export async function actorLabel(user: SessionUser) {
  const { getTranslations } = await import("next-intl/server");
  const tb = await getTranslations({ locale: await getLocale(), namespace: "Back" });
  return `${user.name ?? user.email ?? "Dizy Cars"} (${tb(user.role === "admin" ? "roleAdmin" : "roleManager")})`;
}
