import { cn } from "@/lib/utils";

/** Logotype : "SCar" en Archivo étendu, le point safran fait office de feu de position. */
export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span dir="ltr" className={cn("inline-flex items-baseline text-[22px] leading-none", className)}>
      <span className={cn("display", inverted ? "text-white" : "text-ink")} style={{ lineHeight: 1 }}>
        SCar
      </span>
      <span className="ms-0.5 inline-block size-[7px] rounded-full bg-saffron" aria-hidden />
    </span>
  );
}
