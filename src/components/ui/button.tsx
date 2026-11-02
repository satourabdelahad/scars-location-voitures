import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-majorelle text-white hover:bg-majorelle-deep shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_6px_16px_-8px_var(--majorelle)] dark:text-[#0f1322]",
  secondary: "bg-ink text-chalk hover:bg-ink-2",
  outline: "border border-mist-2 bg-paper text-ink hover:border-ink-3 hover:bg-chalk",
  ghost: "text-ink-2 hover:bg-mist/70 hover:text-ink",
  danger: "bg-danger text-white hover:brightness-95",
  dangerOutline: "border border-danger/40 text-danger hover:bg-danger-soft",
  success: "bg-palm text-white hover:brightness-110",
} as const;

const sizes = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-[10px]",
  lg: "h-12 px-6 text-[15px] gap-2.5 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  asChild?: boolean;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", asChild, loading, disabled, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background,color,box-shadow,transform,border-color] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          )}
          {children}
        </>
      )}
    </Comp>
  );
});
