/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/**
 * Logo officiel Dizy Cars (silhouette dorée, « DIZY CARS », « Rent easy, drive happy »).
 * Deux versions : texte noir sur fond clair, texte blanc en mode sombre ou sur fond foncé (inverted).
 */
export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  const size = cn("block h-10 w-auto", className);
  if (inverted) return <img src="/brand/dizy-cars-logo-dark.png" alt="Dizy Cars" width={640} height={239} className={size} />;
  return (
    <span dir="ltr" className="inline-block">
      <img src="/brand/dizy-cars-logo.png" alt="Dizy Cars" width={640} height={239} className={cn(size, "dark:hidden")} />
      <img src="/brand/dizy-cars-logo-dark.png" alt="" aria-hidden width={640} height={239} className={cn(size, "hidden dark:block")} />
    </span>
  );
}
