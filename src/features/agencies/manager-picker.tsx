"use client";

import { ExternalLink, Lock, Mail, Phone, Save, Search, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ManagerAvatar } from "@/features/managers/manager-avatar";
import { setAgencyManagers } from "@/server/actions/agencies";

export type PickerPerson = {
  id: string;
  civility: "male" | "female";
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  photoUrl: string | null;
  active: boolean;
  isAdmin: boolean;
  /** Badges affichés à côté du nom (responsable, règle, voitures…) */
  badges?: { label: string; tone: "dark" | "success" | "info" | "neutral" }[];
};

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Affectation des gestionnaires d'une agence (responsables ou membres) :
 * « Tous » ou « Sélectionnés », recherche, cases à cocher, puis Enregistrer.
 * locked : toujours sélectionnés, non modifiables ici (ex. responsables dans l'onglet Gestionnaires).
 */
export function ManagerPicker({
  agencyId,
  kind,
  people,
  initial,
  locked = [],
  lockedHint,
  base,
  readOnly = false,
}: {
  agencyId: number;
  kind: "responsible" | "member";
  people: PickerPerson[];
  initial: string[];
  locked?: string[];
  lockedHint?: string;
  base: string;
  readOnly?: boolean;
}) {
  const t = useTranslations("Agencies");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const e = useTranslations("Enums");
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(initial));
  const [view, setView] = useState<"all" | "selected">(initial.length ? "selected" : "all");
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const lockedSet = useMemo(() => new Set(locked), [locked]);
  const isOn = (id: string) => lockedSet.has(id) || chosen.has(id);
  const count = people.filter((p) => isOn(p.id)).length;
  const dirty = chosen.size !== initial.length || initial.some((id) => !chosen.has(id));

  const list = useMemo(() => {
    const needle = norm(q.trim());
    return people.filter((p) => {
      // Comptes désactivés : affichés seulement s'ils sont déjà affectés.
      if (!p.active && !isOn(p.id)) return false;
      if (view === "selected" && !isOn(p.id)) return false;
      if (!needle) return true;
      return norm(`${p.firstName} ${p.lastName} ${p.phone} ${p.email ?? ""}`).includes(needle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, q, view, chosen, lockedSet]);

  const toggle = (id: string) =>
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const save = () =>
    start(async () => {
      const r = await setAgencyManagers(agencyId, kind, [...chosen]);
      if (!r.ok) return void toast.error(te(r.error as "unknown"));
      toast.success(kind === "responsible" ? t("responsiblesSaved") : t("managersSaved"));
      router.refresh();
    });

  return (
    <div className="rounded-2xl border border-mist bg-paper">
      <div className="flex flex-wrap items-center gap-3 border-b border-mist p-4">
        <div role="tablist" className="inline-flex rounded-xl bg-mist/60 p-1 text-sm font-semibold">
          {(["all", "selected"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn("rounded-lg px-3 py-1.5 transition-colors", view === v ? "bg-paper text-ink shadow-sm" : "text-ink-3 hover:text-ink")}
            >
              {v === "all" ? t("pickerAll") : t("pickerSelected", { count })}
            </button>
          ))}
        </div>
        <label className="relative min-w-[min(100%,14rem)] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={q}
            onChange={(x) => setQ(x.target.value)}
            placeholder={t("searchManager")}
            aria-label={t("searchManager")}
            className="h-10 w-full rounded-xl border border-mist-2 bg-paper ps-9 pe-3 text-sm text-ink outline-none placeholder:text-ink-3/70 focus:border-majorelle"
          />
        </label>
        {!readOnly && (
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/managers/new"><UserPlus />{t("addManager")}</Link>
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-ink-3">{view === "selected" ? (kind === "responsible" ? t("noResponsible") : t("noManagers")) : t("noManagerFound")}</p>
      ) : (
        <ul className="divide-y divide-mist">
          {list.map((p) => {
            const isLocked = lockedSet.has(p.id);
            const on = isOn(p.id);
            return (
              <li key={p.id} className={cn("flex items-center gap-3 px-4 py-3", on && "bg-majorelle-soft/30", !p.active && "opacity-60")}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={readOnly || isLocked}
                  onChange={() => toggle(p.id)}
                  aria-label={`${p.firstName} ${p.lastName}`}
                  className="size-4 shrink-0 accent-majorelle"
                />
                <Link href={`${base}/managers/${p.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                  <ManagerAvatar photoUrl={p.photoUrl} firstName={p.firstName} lastName={p.lastName} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-ink group-hover:text-majorelle group-hover:underline">
                        {e(`civility.${p.civility}`)} {p.lastName} {p.firstName}
                      </span>
                      {p.badges?.map((b) => <Badge key={b.label} tone={b.tone}>{b.label}</Badge>)}
                      {isLocked && lockedHint && <span title={lockedHint} className="text-ink-3"><Lock className="size-3.5" /></span>}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-3" dir="ltr">
                      {p.phone && <span className="inline-flex items-center gap-1 tabular"><Phone className="size-3" />{p.phone}</span>}
                      {p.email && <span className="inline-flex min-w-0 items-center gap-1 truncate"><Mail className="size-3" />{p.email}</span>}
                    </span>
                  </span>
                  <ExternalLink className="size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-mist p-4">
          {lockedHint && locked.length > 0 && <p className="me-auto text-xs text-ink-3">{lockedHint}</p>}
          <Button type="button" variant="ghost" disabled={!dirty || pending} onClick={() => setChosen(new Set(initial))}>{tc("cancel")}</Button>
          <Button type="button" loading={pending} disabled={!dirty} onClick={save}><Save />{pending ? tc("saving") : tc("save")}</Button>
        </div>
      )}
    </div>
  );
}
