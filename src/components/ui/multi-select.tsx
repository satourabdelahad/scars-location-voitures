"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Liste déroulante à choix multiples avec recherche (marques, villes…). */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  icon,
  searchPlaceholder,
  allLabel,
  clearLabel,
  emptyLabel,
}: {
  label: string;
  options: { value: string; label: string; count?: number }[];
  value: string[];
  onChange: (v: string[]) => void;
  icon?: ReactNode;
  searchPlaceholder: string;
  /** Texte affiché quand rien n'est choisi (ex. « Toutes les marques ») */
  allLabel: string;
  clearLabel: string;
  emptyLabel: string;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = norm(q.trim());
    return n ? options.filter((o) => norm(o.label).includes(n)) : options;
  }, [q, options]);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  // Résumé avec les libellés (les valeurs peuvent être des identifiants, ex. agences).
  const names = value.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const summary = names.length === 0 ? allLabel : names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
      <Popover.Root onOpenChange={(o) => !o && setQ("")}>
        <Popover.Trigger
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-[10px] border bg-paper px-3 text-start text-[15px] transition-colors data-[state=open]:border-majorelle",
            value.length ? "border-majorelle/50 text-ink" : "border-mist-2 text-ink-3",
          )}
        >
          {icon && <span className="shrink-0 text-ink-3 [&_svg]:size-4">{icon}</span>}
          <span className="min-w-0 flex-1 truncate">{summary}</span>
          {value.length > 0 && <span className="rounded-full bg-majorelle px-1.5 text-[11px] font-bold text-white tabular">{value.length}</span>}
          <ChevronDown className="size-4 shrink-0 text-ink-3" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-64 rounded-2xl border border-mist bg-paper p-2 shadow-xl">
            <label className="mb-1 flex h-9 items-center gap-2 rounded-lg bg-chalk px-2.5">
              <Search className="size-4 text-ink-3" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <ul role="listbox" aria-multiselectable className="scroll-thin max-h-64 overflow-y-auto">
              {shown.map((o) => {
                const on = value.includes(o.value);
                return (
                  <li key={o.value} role="option" aria-selected={on}>
                    <button type="button" onClick={() => toggle(o.value)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-ink hover:bg-chalk">
                      <span className={cn("grid size-4.5 shrink-0 place-items-center rounded border", on ? "border-majorelle bg-majorelle text-white" : "border-mist-2")}>
                        {on && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {o.count !== undefined && <span className="text-xs text-ink-3 tabular">{o.count}</span>}
                    </button>
                  </li>
                );
              })}
              {shown.length === 0 && <li className="px-2.5 py-3 text-sm text-ink-3">{emptyLabel}</li>}
            </ul>
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-3 hover:bg-chalk hover:text-ink">
                <X className="size-3.5" />
                {clearLabel}
              </button>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
