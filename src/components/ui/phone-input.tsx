"use client";

/* eslint-disable @next/next/no-img-element */
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover } from "radix-ui";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { intlLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Pays proposés en premier : Maroc puis les pays d'où viennent le plus de clients. */
const FIRST: CountryCode[] = ["MA", "FR", "ES", "BE", "NL", "DE", "IT", "GB", "US", "CA", "AE", "SA"];

function parse(value: string, fallback: CountryCode) {
  const p = value ? parsePhoneNumberFromString(value) : undefined;
  if (p?.country) return { country: p.country, national: String(p.nationalNumber) };
  if (value?.startsWith("+")) {
    // Indicatif connu mais numéro incomplet : on retrouve le pays par l'indicatif.
    const digits = value.replace(/\D/g, "");
    const match = [...getCountries()]
      .sort((a, b) => getCountryCallingCode(b).length - getCountryCallingCode(a).length)
      .find((c) => digits.startsWith(getCountryCallingCode(c)));
    if (match) return { country: match, national: digits.slice(getCountryCallingCode(match).length) };
  }
  return { country: fallback, national: value.replace(/\D/g, "") };
}

export const Flag = ({ country, className }: { country: string; className?: string }) => (
  <img src={`/flags/${country}.svg`} alt="" width={21} height={14} loading="lazy" className={cn("h-3.5 w-[21px] shrink-0 rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,.08)]", className)} />
);

/**
 * Numéro de téléphone international : menu des pays (drapeau + indicatif) puis le numéro.
 * La valeur transmise est au format international sans espaces, ex. +212612345678.
 */
export function PhoneInput({
  value,
  onChange,
  defaultCountry = "MA",
  disabled,
  id,
  name,
  className,
  ...aria
}: {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: CountryCode;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
}) {
  const t = useTranslations("Phone");
  const locale = useLocale();
  const initial = useMemo(() => parse(value, defaultCountry), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [country, setCountry] = useState<CountryCode>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const numberRef = useRef<HTMLInputElement>(null);

  const names = useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames([intlLocale(locale)], { type: "region" });
    } catch {}
    return (c: string) => dn?.of(c) ?? c;
  }, [locale]);

  const list = useMemo(() => {
    const all = getCountries().filter((c) => !FIRST.includes(c));
    all.sort((a, b) => names(a).localeCompare(names(b), intlLocale(locale)));
    return [...FIRST, ...all].map((c) => ({ code: c, name: names(c), dial: `+${getCountryCallingCode(c)}` }));
  }, [names, locale]);

  const q = query.trim().toLowerCase().replace(/^\+/, "");
  const filtered = q ? list.filter((c) => c.name.toLowerCase().includes(q) || c.dial.slice(1).startsWith(q) || c.code.toLowerCase() === q) : list;

  const emit = (c: CountryCode, n: string) => {
    // Le 0 national (06…) disparaît au format international.
    const digits = n.replace(/\D/g, "").replace(/^0+/, "");
    onChange(digits ? `+${getCountryCallingCode(c)}${digits}` : "");
  };

  return (
    <div
      dir="ltr"
      className={cn(
        "flex h-11 w-full items-stretch overflow-hidden rounded-[10px] border bg-paper transition-[border-color,box-shadow] focus-within:border-majorelle focus-within:ring-4 focus-within:ring-majorelle/15",
        aria["aria-invalid"] ? "border-danger ring-danger/10" : "border-mist-2",
        disabled && "cursor-not-allowed bg-chalk",
        className,
      )}
    >
      <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
        <Popover.Trigger
          type="button"
          disabled={disabled}
          aria-label={t("country", { country: names(country) })}
          className="flex shrink-0 items-center gap-1.5 border-e border-mist-2 px-2.5 text-[15px] text-ink hover:bg-chalk disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent"
        >
          <Flag country={country} />
          <span className="tabular">+{getCountryCallingCode(country)}</span>
          <ChevronDown className="size-3.5 text-ink-3" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className="z-[60] w-[min(320px,calc(100vw-32px))] rounded-xl border border-mist bg-paper p-1.5 shadow-xl"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <label className="mb-1 flex items-center gap-2 rounded-lg bg-chalk px-2.5">
              <Search className="size-4 text-ink-3" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search")}
                aria-label={t("search")}
                className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <ul role="listbox" aria-label={t("countries")} className="scroll-thin max-h-72 overflow-y-auto">
              {filtered.map((c, i) => (
                <li key={c.code} role="option" aria-selected={c.code === country}>
                  {i === FIRST.length && !q && <hr className="my-1 border-mist" />}
                  <button
                    type="button"
                    onClick={() => {
                      setCountry(c.code);
                      emit(c.code, national);
                      setOpen(false);
                      setQuery("");
                      requestAnimationFrame(() => numberRef.current?.focus());
                    }}
                    className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm hover:bg-chalk", c.code === country && "bg-majorelle-soft")}
                  >
                    <Flag country={c.code} />
                    <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
                    <span className="text-xs text-ink-3 tabular">{c.dial}</span>
                    {c.code === country && <Check className="size-4 text-majorelle" />}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="px-3 py-4 text-center text-sm text-ink-3">{t("noResult")}</li>}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <input
        ref={numberRef}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        disabled={disabled}
        value={national}
        onChange={(e) => {
          const raw = e.target.value;
          // Numéro collé au format international : on bascule aussi le pays.
          if (raw.trim().startsWith("+")) {
            const p = parse(raw.replace(/\s/g, ""), country);
            setCountry(p.country);
            setNational(p.national);
            emit(p.country, p.national);
            return;
          }
          setNational(raw.replace(/[^\d\s().-]/g, ""));
          emit(country, raw);
        }}
        placeholder={country === "MA" ? "6 12 34 56 78" : ""}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] text-ink outline-none placeholder:text-ink-3 disabled:cursor-not-allowed disabled:text-ink-3"
        {...aria}
      />
      {name && <input type="hidden" name={name} value={national ? `+${getCountryCallingCode(country)}${national.replace(/\D/g, "").replace(/^0+/, "")}` : ""} />}
    </div>
  );
}
