/** Démarre la barre de chargement du haut de l'écran (voir components/top-loader). */
export const PROGRESS_EVENT = "dizy:progress-start";

export function startProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROGRESS_EVENT));
}
