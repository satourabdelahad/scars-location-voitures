"use client";

import { Check, ChevronDown, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { MOROCCO_CITIES } from "@/lib/morocco-cities";
import { cn } from "@/lib/utils";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/['’-]/g, " ").toLowerCase();

/**
 * Ville : liste déroulante de toutes les villes du Maroc, avec recherche (sans accents).
 * Une ville déjà enregistrée hors de la liste reste affichée et sélectionnable.
 */
export function CityCombobox(props: Omit<Parameters<typeof SuggestCombobox>[0], "options" | "labels" | "icon">) {
  const t = useTranslations("Cities");
  return <SuggestCombobox {...props} options={MOROCCO_CITIES} icon={<MapPin className="size-4 shrink-0 text-ink-3" />} labels={{ search: t("search"), choose: t("choose"), noResult: t("noResult") }} />;
}

/**
 * Liste déroulante avec recherche sur une liste de suggestions (villes, modèles de voiture…).
 * Une valeur absente de la liste reste possible : avec `free`, le texte saisi est accepté tel quel.
 */
export function SuggestCombobox({
  value,
  onChange,
  disabled,
  id,
  className,
  options: source,
  labels,
  icon,
  free = false,
  ...aria
}: {
  options: readonly string[];
  labels: { search: string; choose: string; noResult: string; useTyped?: (q: string) => string };
  icon?: ReactNode;
  /** Autorise une valeur saisie hors de la liste */
  free?: boolean;
  value: string;
  onChange: (city: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const options = useMemo(() => {
    const all: string[] = [...source];
    if (value && !all.includes(value)) all.unshift(value);
    const n = norm(q.trim());
    return n ? all.filter((c) => norm(c).includes(n)).sort((a, b) => Number(!norm(b).startsWith(n)) - Number(!norm(a).startsWith(n)) || a.localeCompare(b, "fr")) : all;
  }, [q, value, source]);
  const typed = q.trim();
  const canUseTyped = free && typed && !options.some((o) => norm(o) === norm(typed));

  const pick = (c: string) => {
    onChange(c);
    setOpen(false);
    setQ("");
  };

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-[10px] border bg-paper px-3 transition-[border-color,box-shadow] focus-within:border-majorelle focus-within:ring-4 focus-within:ring-majorelle/15",
          aria["aria-invalid"] ? "border-danger" : "border-mist-2",
          disabled && "cursor-not-allowed bg-chalk",
        )}
      >
        {icon}
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={open ? q : value}
          placeholder={open ? value || labels.search : labels.choose}
          onFocus={() => {
            setOpen(true);
            setQ("");
            setActive(0);
          }}
          onBlur={() =>
            setTimeout(() => {
              // Saisie libre : le texte tapé devient la valeur en quittant le champ.
              if (free && q.trim() && q.trim() !== value) onChange(q.trim());
              setOpen(false);
            }, 150)
          }
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, options.length - 1));
              listRef.current?.children[Math.min(active + 1, options.length - 1)]?.scrollIntoView({ block: "nearest" });
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
              listRef.current?.children[Math.max(active - 1, 0)]?.scrollIntoView({ block: "nearest" });
            } else if (e.key === "Enter" && (options[active] || canUseTyped)) {
              e.preventDefault();
              pick(options[active] ?? typed);
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3 disabled:cursor-not-allowed disabled:text-ink-3"
          // Le cadre du champ montre déjà le focus : pas de second contour autour du texte.
          style={{ outline: "none" }}
          {...aria}
        />
        <ChevronDown className="size-4 shrink-0 text-ink-3" />
      </div>
      {open && !disabled && (
        <ul ref={listRef} id={listId} role="listbox" className="scroll-thin absolute inset-x-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-xl border border-mist bg-paper p-1 shadow-xl">
          {options.map((c, i) => (
            <li key={c} role="option" aria-selected={c === value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
                className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm text-ink", i === active ? "bg-chalk" : "hover:bg-chalk", c === value && "font-semibold text-majorelle")}
              >
                {c}
                {c === value && <Check className="size-4" />}
              </button>
            </li>
          ))}
          {canUseTyped && labels.useTyped && (
            <li>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(typed)} className="flex w-full rounded-lg px-3 py-2 text-start text-sm font-semibold text-majorelle hover:bg-majorelle-soft">
                {labels.useTyped(typed)}
              </button>
            </li>
          )}
          {options.length === 0 && !canUseTyped && <li className="px-3 py-3 text-sm text-ink-3">{labels.noResult}</li>}
        </ul>
      )}
    </div>
  );
}
