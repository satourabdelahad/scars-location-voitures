import { cn } from "@/lib/utils";

/**
 * Logotype Dizy Cars : "Dizy" en Archivo étendu très gras, "Cars" plus léger,
 * et le point safran qui fait office de feu de position.
 */
export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span dir="ltr" className={cn("inline-flex items-baseline gap-[0.22em] text-[22px] leading-none whitespace-nowrap", className)}>
      <span className={cn("display", inverted ? "text-white" : "text-ink")} style={{ lineHeight: 1 }}>
        Dizy
      </span>
      <span
        className={cn("font-medium", inverted ? "text-white/75" : "text-ink-2")}
        style={{ lineHeight: 1, fontStretch: "100%", letterSpacing: "-0.01em" }}
      >
        Cars
      </span>
      <span className="-ms-[0.12em] inline-block size-[7px] rounded-full bg-saffron" aria-hidden />
    </span>
  );
}
