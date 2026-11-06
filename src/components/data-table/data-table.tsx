"use client";

import { Popover } from "radix-ui";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, RefreshCw, Search, X, ListChecks } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { intlLocale, localeMeta, type Locale } from "@/i18n/config";
import { exportTable, type ExportFormat } from "@/lib/export";
import { cn } from "@/lib/utils";
import { saveTablePreferences } from "@/server/actions/managers";
import { logExport } from "@/server/actions/audit";
import { ExportMenu } from "./export-menu";

export type Column<T> = {
  id: string;
  header: string;
  /** Valeur utilisée pour le tri */
  sortValue?: (row: T) => string | number | null;
  /** Texte utilisé pour la recherche, les filtres et les exports */
  text: (row: T) => string;
  cell?: (row: T) => ReactNode;
  /** combobox : saisie libre avec suggestions (valeurs distinctes de la colonne si options est omis) */
  filter?: { type: "text" } | { type: "select"; options: { value: string; label: string }[] } | { type: "combobox"; options?: string[] };
  align?: "start" | "end" | "center";
  /** Colonne d'action : jamais exportée, jamais masquable */
  isAction?: boolean;
  defaultHidden?: boolean;
  /** Colonne ajoutée dans une version récente : affichée même avec des préférences enregistrées avant elle */
  addedLater?: boolean;
  minWidth?: number;
};

type Sort = { id: string; dir: "asc" | "desc" } | null;
const PAGE_SIZES = [25, 50, 100] as const;

/** Normalise pour une recherche insensible aux accents et à la casse (é = e, Ç = c…). */
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function DataTable<T extends { id: string }>({
  tableKey,
  columns,
  data,
  initialPrefs,
  exportTitle,
  exportFilename,
  toolbar,
  rowClassName,
  onRowClick,
  bulkActions,
}: {
  tableKey: string;
  columns: Column<T>[];
  data: T[];
  initialPrefs?: { visibleColumns: string[]; pageSize: number } | null;
  exportTitle: string;
  exportFilename: string;
  toolbar?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  /** Active la sélection de lignes et affiche ces actions groupées quand des lignes sont cochées */
  bulkActions?: (rows: T[], clear: () => void) => ReactNode;
}) {
  const t = useTranslations("Table");
  const locale = useLocale() as Locale;
  const collator = useMemo(() => new Intl.Collator(intlLocale(locale), { numeric: true, sensitivity: "base" }), [locale]);

  const hideable = columns.filter((c) => !c.isAction);
  const defaultVisible = hideable.filter((c) => !c.defaultHidden).map((c) => c.id);
  const [visible, setVisible] = useState<string[]>(() => {
    const known = new Set(hideable.map((c) => c.id));
    const entries = initialPrefs?.visibleColumns ?? [];
    // "!id" = colonne masquée volontairement ; une colonne inconnue des préférences suit son réglage par défaut.
    const hidden = new Set(entries.filter((e) => e.startsWith("!")).map((e) => e.slice(1)));
    const saved = entries.filter((id) => known.has(id));
    if (!saved.length) return defaultVisible;
    const seen = new Set([...saved, ...hidden]);
    const added = hideable.filter((c) => !c.defaultHidden && !seen.has(c.id) && (hidden.size > 0 || c.addedLater)).map((c) => c.id);
    return [...saved, ...added];
  });
  const [pageSize, setPageSize] = useState<number>(initialPrefs?.pageSize ?? 25);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  // Seules les lignes encore présentes restent sélectionnées (après une actualisation).
  const selectedRows = useMemo(() => data.filter((r) => selected.has(r.id)), [data, selected]);
  const clearSelection = () => setSelected(new Set());

  // Préférences : enregistrées en base (par utilisateur) avec un léger délai, relues côté serveur au chargement.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const hiddenIds = hideable.filter((c) => !visible.includes(c.id)).map((c) => `!${c.id}`);
    const h = setTimeout(() => void saveTablePreferences(tableKey, [...visible, ...hiddenIds], pageSize), 500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pageSize, tableKey]);

  const shown = columns.filter((c) => c.isAction || visible.includes(c.id));
  // L'ordre des colonnes reste celui de la définition, quel que soit l'ordre de sélection.
  const orderedVisible = hideable.filter((c) => visible.includes(c.id));

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    const active = Object.entries(filters).filter(([, v]) => v);
    return data.filter((row) => {
      for (const [id, v] of active) {
        const col = columns.find((c) => c.id === id);
        if (!col) continue;
        const cellText = col.text(row);
        if (col.filter?.type === "select") {
          // La valeur d'option peut être un code (ex. "active") ou le libellé affiché.
          const label = col.filter.options.find((o) => o.value === v)?.label;
          if (cellText !== v && cellText !== label) return false;
        } else if (!norm(cellText).includes(norm(v))) return false;
      }
      if (!q) return true;
      return orderedVisible.some((c) => norm(c.text(row)).includes(q));
    });
  }, [data, query, filters, columns, orderedVisible]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.id === sort.id);
    if (!col) return filtered;
    const val = col.sortValue ?? col.text;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va == null || va === "") return 1;
      if (vb == null || vb === "") return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return collator.compare(String(va), String(vb)) * dir;
    });
  }, [filtered, sort, columns, collator]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (id: string) =>
    setSort((s) => (!s || s.id !== id ? { id, dir: "asc" } : s.dir === "asc" ? { id, dir: "desc" } : null));

  const onExport = useCallback(
    async (format: ExportFormat) => {
      await exportTable(
        {
          title: exportTitle,
          subtitle: `${new Date().toLocaleString(intlLocale(locale))} · ${sorted.length}`,
          columns: orderedVisible.map((c) => ({ key: c.id, label: c.header })),
          rows: sorted.map((r) => orderedVisible.map((c) => c.text(r))),
          filename: `${exportFilename}-${new Date().toISOString().slice(0, 10)}`,
          rtl: localeMeta[locale].dir === "rtl",
        },
        format,
      );
      void logExport({ kind: "table", key: tableKey, title: exportTitle, format, rows: sorted.length });
    },
    [exportTitle, exportFilename, sorted, orderedVisible, locale, tableKey],
  );

  const hasFilters = query || Object.values(filters).some(Boolean);
  const from = sorted.length ? current * pageSize + 1 : 0;
  const to = Math.min(sorted.length, (current + 1) * pageSize);

  return (
    <div className="overflow-hidden rounded-2xl border border-mist bg-paper">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2 border-b border-mist p-3">
        <label className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-10 w-full rounded-[10px] border border-mist-2 bg-chalk ps-9 pe-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-majorelle focus:bg-paper"
          />
        </label>
        {hasFilters && (
          <button type="button" onClick={() => { setQuery(""); setFilters({}); setPage(0); }} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium text-ink-3 hover:bg-chalk hover:text-ink">
            <X className="size-4" />
            {t("resetFilters")}
          </button>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {bulkActions && selectedRows.length === 0 && (
            // Toujours visible : indique que l'action groupée existe et comment l'utiliser.
            <span className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-dashed border-mist-2 px-3 text-sm font-medium text-ink-3">
              <ListChecks className="size-4" />
              {t("bulkHint")}
            </span>
          )}
          {bulkActions && selectedRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-majorelle-soft px-2 py-1">
              <span className="px-1 text-sm font-semibold text-majorelle">
                <ListChecks className="me-1 inline size-4 align-[-3px]" />
                {t("bulkLabel")} · {t("selected", { count: selectedRows.length })}
              </span>
              {bulkActions(selectedRows, clearSelection)}
              <button type="button" onClick={clearSelection} aria-label={t("clearSelection")} title={t("clearSelection")} className="grid size-8 place-items-center rounded-lg text-majorelle hover:bg-paper">
                <X className="size-4" />
              </button>
            </div>
          )}
          {toolbar}
          <button
            type="button"
            onClick={() => startRefresh(() => router.refresh())}
            aria-label={t("refresh")}
            title={t("refresh")}
            className="grid size-10 place-items-center rounded-[10px] border border-mist-2 bg-paper text-ink hover:border-ink-3"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </button>
          <Popover.Root>
            <Popover.Trigger className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-mist-2 bg-paper px-3.5 text-sm font-semibold text-ink hover:border-ink-3 data-[state=open]:border-majorelle">
              <Columns3 className="size-4" />
              {t("columns")}
              <span className="rounded-full bg-mist px-1.5 text-xs tabular">{visible.length}/{hideable.length}</span>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={6} className="z-50 w-72 rounded-2xl border border-mist bg-paper p-3 shadow-[0_24px_60px_-20px_rgba(20,26,46,.35)] data-[state=open]:animate-[pop-in_.16s_var(--ease-road)]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-ink">{t("columns")}</p>
                  <button type="button" className="text-xs font-semibold text-majorelle hover:underline" onClick={() => setVisible(hideable.map((c) => c.id))}>
                    {t("showAll")}
                  </button>
                </div>
                <p className="mb-2 text-xs text-ink-3">{t("columnsHint")}</p>
                <ul className="scroll-thin max-h-80 space-y-0.5 overflow-auto">
                  {hideable.map((c) => {
                    const on = visible.includes(c.id);
                    return (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-2 hover:bg-chalk">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--majorelle)]"
                            checked={on}
                            disabled={on && visible.length === 1}
                            onChange={() => setVisible((v) => (on ? v.filter((x) => x !== c.id) : [...v, c.id]))}
                          />
                          {c.header}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <ExportMenu onExport={onExport} />
        </div>
      </div>

      {/* Tableau */}
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-mist bg-chalk/60">
              {bulkActions && (
                <th rowSpan={2} className="w-10 px-3">
                  <input
                    type="checkbox"
                    aria-label={t("selectAll")}
                    className="size-4 accent-[var(--majorelle)]"
                    checked={sorted.length > 0 && sorted.every((r) => selected.has(r.id))}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedRows.length > 0 && !sorted.every((r) => selected.has(r.id));
                    }}
                    onChange={(e) => setSelected(e.target.checked ? new Set(sorted.map((r) => r.id)) : new Set())}
                  />
                </th>
              )}
              {shown.map((c) => {
                const s = sort?.id === c.id ? sort.dir : null;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={s === "asc" ? "ascending" : s === "desc" ? "descending" : undefined}
                    className={cn("px-3 pt-3 pb-1.5 text-start align-bottom text-xs font-semibold whitespace-nowrap text-ink-3", c.align === "end" && "text-end", c.align === "center" && "text-center")}
                    style={c.minWidth ? { minWidth: c.minWidth } : undefined}
                  >
                    {c.isAction ? (
                      <span>{c.header}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.id)}
                        title={s === "asc" ? t("sortDesc") : t("sortAsc")}
                        className={cn("inline-flex items-center gap-1.5 rounded-md py-0.5 hover:text-ink", s && "text-ink")}
                      >
                        {c.header}
                        {s === "asc" ? <ArrowUp className="size-3.5 text-majorelle" /> : s === "desc" ? <ArrowDown className="size-3.5 text-majorelle" /> : <ArrowUpDown className="size-3.5 opacity-40" />}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
            {/* Recherche par colonne */}
            <tr className="border-b border-mist bg-chalk/60">
              {shown.map((c) => (
                <th key={c.id} className="px-3 pb-2.5 font-normal">
                  {c.filter?.type === "select" ? (
                    <select
                      value={filters[c.id] ?? ""}
                      onChange={(e) => { setFilters((f) => ({ ...f, [c.id]: e.target.value })); setPage(0); }}
                      aria-label={`${t("filterColumn")} ${c.header}`}
                      className="h-8 w-full min-w-24 rounded-lg border border-mist-2 bg-paper px-2 text-[13px] text-ink outline-none focus:border-majorelle"
                    >
                      <option value="">—</option>
                      {c.filter.options.map((o) => <option key={o.value} value={o.label}>{o.label}</option>)}
                    </select>
                  ) : c.filter?.type === "combobox" ? (
                    <>
                      <input
                        list={`dt-${tableKey}-${c.id}`}
                        value={filters[c.id] ?? ""}
                        onChange={(e) => { setFilters((f) => ({ ...f, [c.id]: e.target.value })); setPage(0); }}
                        placeholder={t("filterColumn")}
                        aria-label={`${t("filterColumn")} ${c.header}`}
                        className="h-8 w-full min-w-24 rounded-lg border border-mist-2 bg-paper px-2 text-[13px] text-ink outline-none placeholder:text-ink-3/70 focus:border-majorelle"
                      />
                      <datalist id={`dt-${tableKey}-${c.id}`}>
                        {(c.filter.options ?? [...new Set(data.map((r) => c.text(r)).filter(Boolean))].sort((x, y) => collator.compare(x, y))).map((o) => <option key={o} value={o} />)}
                      </datalist>
                    </>
                  ) : c.filter?.type === "text" ? (
                    <input
                      value={filters[c.id] ?? ""}
                      onChange={(e) => { setFilters((f) => ({ ...f, [c.id]: e.target.value })); setPage(0); }}
                      placeholder={t("filterColumn")}
                      aria-label={`${t("filterColumn")} ${c.header}`}
                      className="h-8 w-full min-w-24 rounded-lg border border-mist-2 bg-paper px-2 text-[13px] text-ink outline-none placeholder:text-ink-3/70 focus:border-majorelle"
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={shown.length + (bulkActions ? 1 : 0)} className="px-4 py-16 text-center text-ink-3">{t("noResults")}</td>
              </tr>
            ) : (
              slice.map((row) => (
                <tr
                  key={row.id}
                  onClick={
                    onRowClick
                      ? (e) => {
                          const target = e.target as HTMLElement;
                          // Clic dans une boîte de dialogue (rendue dans un portail) ou sur un contrôle : pas de navigation.
                          if (!e.currentTarget.contains(target) || target.closest("a,button,input,select,textarea,label,[role=dialog]")) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                  className={cn("border-b border-mist/70 transition-colors last:border-0 hover:bg-chalk/70", onRowClick && "cursor-pointer", selected.has(row.id) && "bg-majorelle-soft/50", rowClassName?.(row))}
                >
                  {bulkActions && (
                    <td className="w-10 px-3">
                      <input
                        type="checkbox"
                        aria-label={t("selectRow")}
                        className="size-4 accent-[var(--majorelle)]"
                        checked={selected.has(row.id)}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(row.id);
                            else next.delete(row.id);
                            return next;
                          })
                        }
                      />
                    </td>
                  )}
                  {shown.map((c) => (
                    <td key={c.id} className={cn("px-3 py-3 whitespace-nowrap text-ink-2", c.align === "end" && "text-end tabular", c.align === "center" && "text-center")}>
                      {c.cell ? c.cell(row) : c.text(row) || "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist px-3 py-2.5 text-sm text-ink-3">
        <label className="flex items-center gap-2">
          {t("rowsPerPage")}
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="h-8 rounded-lg border border-mist-2 bg-paper px-2 text-ink outline-none focus:border-majorelle">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <p className="tabular" aria-live="polite">{t("showing", { from, to, total: sorted.length })}</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0} className="grid size-8 place-items-center rounded-lg text-ink hover:bg-chalk disabled:opacity-35" aria-label={t("previous")}>
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </button>
          <span className="px-2 tabular">{t("page", { page: current + 1, pages })}</span>
          <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} className="grid size-8 place-items-center rounded-lg text-ink hover:bg-chalk disabled:opacity-35" aria-label={t("next")}>
            <ChevronRight className="size-4 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
