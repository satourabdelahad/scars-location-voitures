"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { PROGRESS_EVENT } from "@/lib/progress";

/**
 * Fine barre de progression en haut de l'écran pendant chaque changement de page.
 * Elle démarre au clic sur un lien interne (ou via startProgress() pour router.push)
 * et se termine quand l'URL affichée change. Le style est piloté directement sur le
 * DOM pour ne provoquer aucun rendu React pendant l'animation.
 */
function Loader() {
  const bar = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const value = useRef(0);
  const running = useRef(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const paint = () => {
      el.style.transform = `scaleX(${value.current})`;
    };
    const stopTimer = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
    const start = () => {
      if (running.current) return;
      running.current = true;
      stopTimer();
      value.current = 0.08;
      el.style.transition = "none";
      el.style.opacity = "1";
      paint();
      requestAnimationFrame(() => {
        el.style.transition = "transform 200ms ease-out, opacity 300ms ease";
        timer.current = setInterval(() => {
          // Avance de plus en plus lentement sans jamais atteindre la fin.
          value.current = Math.min(0.92, value.current + (0.92 - value.current) * 0.12);
          paint();
        }, 180);
      });
      // Filet de sécurité : si aucune navigation n'aboutit, on termine quand même.
      setTimeout(() => running.current && done(), 15000);
    };
    const done = () => {
      if (!running.current) return;
      running.current = false;
      stopTimer();
      value.current = 1;
      paint();
      setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => {
          if (running.current) return;
          el.style.transition = "none";
          value.current = 0;
          paint();
        }, 320);
      }, 180);
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    const onDone = () => done();

    document.addEventListener("click", onClick, true);
    window.addEventListener(PROGRESS_EVENT, start);
    window.addEventListener("popstate", start);
    window.addEventListener("dizy:progress-done", onDone);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(PROGRESS_EVENT, start);
      window.removeEventListener("popstate", start);
      window.removeEventListener("dizy:progress-done", onDone);
      stopTimer();
    };
  }, []);

  // L'URL a changé : la nouvelle page est affichée, on termine la barre.
  useEffect(() => {
    window.dispatchEvent(new Event("dizy:progress-done"));
  }, [pathname, search]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        ref={bar}
        className="h-full origin-left bg-gradient-to-r from-majorelle via-majorelle to-saffron opacity-0 shadow-[0_0_10px_var(--color-majorelle)] rtl:origin-right rtl:bg-gradient-to-l"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}

export function TopLoader() {
  return (
    <Suspense fallback={null}>
      <Loader />
    </Suspense>
  );
}
