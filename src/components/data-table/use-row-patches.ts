"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Mise à jour immédiate des lignes d'un tableau après une action (activer, désactiver…),
 * sans attendre le rechargement des données du serveur. Les corrections locales
 * sont oubliées dès que de nouvelles données arrivent (router.refresh).
 */
export function useRowPatches<T extends { id: string }>(rows: T[]) {
  const [state, setState] = useState<{ base: T[]; patches: Record<string, Partial<T>> }>({ base: rows, patches: {} });
  const patches = state.base === rows ? state.patches : null;

  const merged = useMemo(
    () => (patches && Object.keys(patches).length ? rows.map((r) => (patches[r.id] ? { ...r, ...patches[r.id] } : r)) : rows),
    [rows, patches],
  );

  const patch = useCallback(
    (ids: string | string[], value: Partial<T>) =>
      setState((s) => {
        const current = s.base === rows ? s.patches : {};
        const next = { ...current };
        for (const id of Array.isArray(ids) ? ids : [ids]) next[id] = { ...next[id], ...value };
        return { base: rows, patches: next };
      }),
    [rows],
  );

  return [merged, patch] as const;
}
