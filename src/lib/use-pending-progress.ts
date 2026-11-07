"use client";

import { useEffect } from "react";
import { doneProgress, startProgress } from "@/lib/progress";

/** Affiche la barre du haut pendant une action serveur (connexion, inscription…). */
export function usePendingProgress(pending: boolean) {
  useEffect(() => {
    if (pending) startProgress();
    else doneProgress();
  }, [pending]);
}
