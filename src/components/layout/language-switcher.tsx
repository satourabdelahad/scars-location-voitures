"use client";

import { Popover } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { locales, localeMeta, type Locale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/flags";
import { startProgress } from "@/lib/progress";

/** Combobox de langue (affichée en haut à droite dans toutes les langues, y compris en arabe). */
export function LanguageSwitcher({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const t = useTranslations("Nav");
  const current = useLocale() as Locale;
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locales.filter((l) => {
      if (!q) return true;
      const m = localeMeta[l];
      return [l, m.label, m.native].some((s) => s.toLowerCase().includes(q));
    });
  }, [query]);

  function choose(locale: Locale) {
    setOpen(false);
    setQuery("");
    if (locale === current) return;
    const qs = search.toString();
    // Barre de chargement dès le choix, jusqu'à l'affichage dans la nouvelle langue.
    startProgress();
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { locale, scroll: false });
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const l = options[active];
      if (l) choose(l);
    }
  }

  const meta = localeMeta[current];
  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setActive(Math.max(0, locales.indexOf(current)));
      }}
    >
      <Popover.Trigger
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t("language")} : ${meta.native}`}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors",
          tone === "dark"
            ? "border-white/20 text-white hover:bg-white/10"
            : "border-mist-2 bg-paper text-ink hover:border-ink-3",
          pending && "opacity-60",
          className,
        )}
      >
        <Flag locale={current} />
        <span dir="auto">{meta.native}</span>
        <ChevronDown className="size-3.5 opacity-60" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="z-50 w-64 rounded-2xl border border-mist bg-paper p-2 shadow-[0_24px_60px_-20px_rgba(20,26,46,.35)] data-[state=open]:animate-[pop-in_.16s_var(--ease-road)]"
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t("language")}
            aria-label={t("language")}
            aria-controls={listId}
            aria-activedescendant={options[active] ? `${listId}-${options[active]}` : undefined}
            className="mb-1 h-9 w-full rounded-lg bg-chalk px-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-majorelle/30"
          />
          <ul id={listId} role="listbox" aria-label={t("language")} className="max-h-80 overflow-auto">
            {options.map((l, i) => {
              const m = localeMeta[l];
              const selected = l === current;
              return (
                <li
                  key={l}
                  id={`${listId}-${l}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(l)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
                    i === active ? "bg-majorelle-soft text-ink" : "text-ink-2",
                  )}
                >
                  <Flag locale={l} className="h-5 w-7" />
                  <span className="flex-1" dir={m.dir} lang={l === "ary" ? "ar" : l}>
                    {m.native}
                  </span>
                  {selected && <Check className="size-4 text-majorelle" aria-hidden />}
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
