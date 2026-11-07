/** Démarre la barre de chargement du haut de l'écran (voir components/top-loader). */
export const PROGRESS_EVENT = "dizy:progress-start";

export function startProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROGRESS_EVENT));
}

export const PROGRESS_DONE_EVENT = "dizy:progress-done";

/** Termine la barre (action qui n'a finalement pas changé de page, par ex. mot de passe erroné). */
export function doneProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROGRESS_DONE_EVENT));
}
