"use client";

import { Search, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { cn } from "@/lib/utils";
import { createClient, searchClients } from "@/server/actions/clients";
import type { ClientOption } from "@/server/queries/clients";

/**
 * Choix d'un client : recherche parmi les clients existants (nom, email, téléphone),
 * et, si besoin, création immédiate d'un nouveau client.
 */
export function ClientPicker({
  value,
  onChange,
  allowCreate = true,
  invalid,
  id,
}: {
  value: ClientOption | null;
  onChange: (client: ClientOption | null) => void;
  allowCreate?: boolean;
  invalid?: boolean;
  id?: string;
}) {
  const t = useTranslations("Clients");
  const te = useTranslations("Errors");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ClientOption[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function search(text: string) {
    setQ(text);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 2) return setResults([]);
    timer.current = setTimeout(async () => setResults(await searchClients(text)), 250);
  }

  function create() {
    setErrors({});
    start(async () => {
      const r = await createClient({ ...draft, preferredLocale: "fr" });
      if (r.ok) {
        onChange({ id: r.data!.id, name: r.data!.name, email: r.data!.email, phone: r.data!.phone });
        setCreating(false);
        setDraft({ firstName: "", lastName: "", phone: "", email: "" });
      } else setErrors(r.fieldErrors ?? { _: r.error });
    });
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-[10px] border border-majorelle/30 bg-majorelle-soft px-3 py-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-majorelle text-xs font-bold text-white">{value.name.charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{value.name}</span>
          <span className="block truncate text-xs text-ink-3" dir="ltr">{[value.phone, value.email].filter(Boolean).join(" · ")}</span>
        </span>
        <button type="button" onClick={() => onChange(null)} aria-label={t("changeClient")} title={t("changeClient")} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-paper hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!creating && (
        <div className="relative">
          <label className={cn("flex h-11 items-center gap-2 rounded-[10px] border bg-paper px-3 focus-within:border-majorelle focus-within:ring-4 focus-within:ring-majorelle/15", invalid ? "border-danger" : "border-mist-2")}>
            <Search className="size-4 text-ink-3" />
            <input
              id={id}
              value={q}
              onChange={(e) => search(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={t("searchPlaceholder")}
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              autoComplete="off"
            />
          </label>
          {open && q.trim().length >= 2 && (
            <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-mist bg-paper p-1 shadow-xl">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(c);
                      setQ("");
                      setOpen(false);
                    }}
                    className="flex w-full flex-col rounded-lg px-3 py-2 text-start hover:bg-chalk"
                  >
                    <span className="text-sm font-semibold text-ink">{c.name}</span>
                    <span className="text-xs text-ink-3" dir="ltr">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 && <li className="px-3 py-3 text-sm text-ink-3">{t("noMatch")}</li>}
            </ul>
          )}
        </div>
      )}

      {allowCreate && !creating && (
        <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-majorelle hover:underline">
          <UserPlus className="size-4" />
          {t("createInline")}
        </button>
      )}

      {creating && (
        <div className="space-y-3 rounded-xl border border-mist bg-chalk/60 p-4">
          <p className="text-sm font-semibold text-ink">{t("newClient")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("firstName")} required error={errors.firstName ? te(errors.firstName as "required") : undefined}>
              {(p) => <Input {...p} value={draft.firstName} onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))} />}
            </Field>
            <Field label={t("lastName")} required error={errors.lastName ? te(errors.lastName as "required") : undefined}>
              {(p) => <Input {...p} value={draft.lastName} onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))} />}
            </Field>
            <Field label={t("phone")} required error={errors.phone ? te(errors.phone as "phone") : undefined}>
              {(p) => <PhoneInput {...p} value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} />}
            </Field>
            <Field label={t("email")} error={errors.email ? te(errors.email as "email") : undefined}>
              {(p) => <Input {...p} type="email" dir="ltr" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />}
            </Field>
          </div>
          {errors._ && <p className="text-sm text-danger">{te(errors._ as "unknown")}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>{t("cancel")}</Button>
            <Button type="button" size="sm" loading={pending} onClick={create}>
              <UserPlus />
              {t("createAndSelect")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
