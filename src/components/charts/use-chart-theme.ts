"use client";

import { useEffect, useState } from "react";

/**
 * Palette catégorielle validée (ordre fixe, jamais recyclée) et couleurs d'encre des graphiques.
 * Le mode sombre utilise ses propres paliers, choisis pour la surface sombre.
 */
const LIGHT = {
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  single: "#4b3fd8",
  grid: "#e3e5ef",
  axis: "#6b7390",
  text: "#141a2e",
  surface: "#ffffff",
  other: "#9aa3b5",
};
const DARK = {
  series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  single: "#8c84ff",
  grid: "#262c45",
  axis: "#8b92ad",
  text: "#eef0f8",
  surface: "#171c30",
  other: "#5b6280",
};

export function useChartTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.dataset.theme === "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return dark ? DARK : LIGHT;
}
