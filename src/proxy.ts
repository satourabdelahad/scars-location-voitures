import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/** Next.js 16 : "proxy" remplace "middleware". Il gère ici le préfixe de langue (/fr, /ar, /ja…). */
export const proxy = createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
