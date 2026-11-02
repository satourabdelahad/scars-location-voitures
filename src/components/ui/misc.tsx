import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-mist text-ink-2",
  info: "bg-majorelle-soft text-majorelle",
  success: "bg-palm-soft text-palm",
  warning: "bg-saffron/20 text-saffron-ink",
  danger: "bg-danger-soft text-danger",
  dark: "bg-ink text-chalk",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, children, dot }: { tone?: Tone; className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export const reservationTone: Record<string, Tone> = {
  pending: "warning",
  confirmed: "info",
  ongoing: "dark",
  completed: "success",
  cancelled: "neutral",
  rejected: "danger",
};

/** Panneau de base des espaces de gestion : fond papier, bordure fine, pas d'ombre. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-mist bg-paper", className)} {...props} />;
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="display-md text-[28px] text-ink sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-majorelle-soft text-majorelle [&_svg]:size-6">{icon}</div>}
      <p className="text-lg font-bold text-ink">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function DefinitionList({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium text-ink-3">{it.label}</dt>
          <dd className="mt-0.5 truncate text-[15px] font-medium text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
