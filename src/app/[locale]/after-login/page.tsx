import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { homeForRole } from "@/server/guards";

/** Aiguillage après connexion : chaque rôle arrive dans son espace. */
export default async function AfterLogin() {
  const session = await auth();
  const locale = await getLocale();
  redirect({ href: session?.user ? homeForRole(session.user.role) : "/login", locale });
}
