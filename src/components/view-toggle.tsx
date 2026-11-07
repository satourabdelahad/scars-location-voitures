"use client";

import { GanttChart, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export type ViewMode = "table" | "timeline";

const listeners = new Set<() => void>();
const read = (key: string): ViewMode | null => {
  try {
    const v = localStorage.getItem(`dizy.view.${key}`);
    return v === "table" || v === "timeline" ? v : null;
  } catch {
    return null;
  }
};

/** Choix Tableau / Timeline, mémorisé par navigateur pour chaque écran. */
export function useViewMode(key: string, fallback: ViewMode = "table") {
  const mode = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => read(key) ?? fallback,
    () => fallback,
  );
  const update = (m: ViewMode) => {
    try {
      localStorage.setItem(`dizy.view.${key}`, m);
    } catch {}
    listeners.forEach((l) => l());
  };
  return [mode, update] as const;
}

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const t = useTranslations("Managers");
  const opts: { id: ViewMode; label: string; Icon: typeof Table2 }[] = [
    { id: "table", label: t("viewTable"), Icon: Table2 },
    { id: "timeline", label: t("viewTimeline"), Icon: GanttChart },
  ];
  return (
    <div role="radiogroup" aria-label={t("viewTable")} className="inline-flex rounded-[10px] bg-chalk p-1">
      {opts.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
            mode === id ? "bg-paper text-ink shadow-sm" : "text-ink-3 hover:text-ink",
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
