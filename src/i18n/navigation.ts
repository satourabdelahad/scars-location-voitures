import { createNavigation } from "next-intl/navigation";
import { useMemo } from "react";
import { startProgress } from "@/lib/progress";
import { routing } from "./routing";

const nav = createNavigation(routing);
export const { Link, redirect, usePathname, getPathname } = nav;

/** useRouter de next-intl, qui lance aussi la barre de chargement sur push. */
export function useRouter() {
  const router = nav.useRouter();
  return useMemo(
    () => ({
      ...router,
      push: (...args: Parameters<typeof router.push>) => {
        startProgress();
        return router.push(...args);
      },
    }),
    [router],
  );
}
