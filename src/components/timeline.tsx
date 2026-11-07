import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  /** Date ISO servant au regroupement par mois */
  at: string;
  title: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
  aside?: ReactNode;
  icon?: ReactNode;
  /** Couleur du repère : classes Tailwind de fond + texte */
  tone?: string;
};

/** Frise chronologique verticale, regroupée par mois. */
export function Timeline({ items, monthLabel, empty }: { items: TimelineItem[]; monthLabel: (iso: string) => string; empty: ReactNode }) {
  if (!items.length) return <p className="px-2 py-12 text-center text-sm text-ink-3">{empty}</p>;
  const groups: { key: string; label: string; items: TimelineItem[] }[] = [];
  for (const it of items) {
    const key = it.at.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: monthLabel(it.at), items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="sticky top-16 z-10 mb-3 inline-block rounded-full bg-ink px-3 py-1 text-xs font-bold text-chalk capitalize">{g.label}</h3>
          <ol className="relative ms-3 space-y-4 border-s-2 border-mist ps-6">
            {g.items.map((it) => (
              <li key={it.id} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -start-[37px] top-1 grid size-6 place-items-center rounded-full ring-4 ring-paper [&_svg]:size-3.5",
                    it.tone ?? "bg-majorelle-soft text-majorelle",
                  )}
                >
                  {it.icon}
                </span>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-1 rounded-xl border border-mist bg-paper px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{it.title}</p>
                    {it.meta && <p className="mt-0.5 text-xs text-ink-3">{it.meta}</p>}
                    {it.detail && <div className="mt-1.5 text-sm text-ink-2">{it.detail}</div>}
                  </div>
                  {it.aside && <div className="shrink-0 text-end">{it.aside}</div>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
