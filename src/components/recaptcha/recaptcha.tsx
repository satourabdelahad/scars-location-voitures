"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const BUILD_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";
/** Clé du site : celle du build, sinon celle donnée par le serveur dans <meta name="recaptcha-site-key">. */
function siteKey() {
  if (BUILD_KEY) return BUILD_KEY;
  if (typeof document === "undefined") return "";
  return document.querySelector<HTMLMetaElement>('meta[name="recaptcha-site-key"]')?.content ?? "";
}
const noop = () => () => {};
function useSiteKey() {
  return useSyncExternalStore(noop, siteKey, () => BUILD_KEY);
}

type Grecaptcha = { ready: (cb: () => void) => void; execute: (key: string, opts: { action: string }) => Promise<string> };
declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

function waitForGrecaptcha(timeout = 8000): Promise<Grecaptcha | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (window.grecaptcha?.execute) return window.grecaptcha.ready(() => resolve(window.grecaptcha!));
      if (Date.now() - started > timeout) return resolve(null);
      setTimeout(tick, 100);
    };
    tick();
  });
}

/** Jeton reCAPTCHA v3 pour une action (connexion, inscription…). Chaîne vide si la clé n'est pas configurée. */
export async function getRecaptchaToken(action: string): Promise<string> {
  const key = siteKey();
  if (!key || typeof window === "undefined") return "";
  const g = await waitForGrecaptcha();
  if (!g) {
    console.warn("[recaptcha] le script Google ne s'est pas chargé (bloqueur de publicité, réseau ou clé invalide).");
    return "";
  }
  try {
    const token = await g.execute(key, { action });
    if (!token) console.warn("[recaptcha] Google n'a pas renvoyé de jeton : vérifiez que la clé est une clé v3 et que ce domaine est autorisé.");
    return token;
  } catch (e) {
    console.warn("[recaptcha] échec de grecaptcha.execute : clé non v3 ou domaine non autorisé dans la console reCAPTCHA.", e);
    return "";
  }
}

/** Charge le script reCAPTCHA v3 (une seule fois par page) quand la clé du site est configurée. */
export function RecaptchaScript() {
  const key = useSiteKey();
  if (!key) return null;
  return <Script src={`https://www.google.com/recaptcha/api.js?render=${key}`} strategy="afterInteractive" />;
}

/**
 * Champ caché "recaptcha" pour les formulaires envoyés par une action serveur.
 * Le jeton est valable 2 minutes et ne sert qu'une fois : il est renouvelé régulièrement
 * et après chaque envoi (changer `refreshKey`).
 */
export function RecaptchaField({ action, refreshKey }: { action: string; refreshKey?: unknown }) {
  const key = useSiteKey();
  const [token, setToken] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const refresh = useCallback(() => {
    getRecaptchaToken(action).then(setToken);
  }, [action]);
  useEffect(() => {
    if (!key) return;
    refresh();
    const id = setInterval(refresh, 90_000);
    return () => clearInterval(id);
  }, [key, refresh, refreshKey]);
  // Envoi avant que le jeton soit prêt : on attend un jeton frais, puis on renvoie le formulaire.
  useEffect(() => {
    const form = input.current?.form;
    if (!form || !key) return;
    let waited = false;
    const onSubmit = (e: SubmitEvent) => {
      // Jeton prêt, ou déjà attendu une fois (échec : le serveur affichera le message).
      if (input.current?.value || waited) {
        waited = false;
        return;
      }
      waited = true;
      e.preventDefault();
      e.stopImmediatePropagation();
      getRecaptchaToken(action).then((t) => {
        if (input.current) input.current.value = t;
        setToken(t);
        form.requestSubmit(e.submitter instanceof HTMLElement ? (e.submitter as HTMLButtonElement) : undefined);
      });
    };
    form.addEventListener("submit", onSubmit, { capture: true });
    return () => form.removeEventListener("submit", onSubmit, { capture: true });
  }, [key, action]);
  if (!key) return null;
  return (
    <>
      <RecaptchaScript />
      <input ref={input} type="hidden" name="recaptcha" value={token} onChange={() => {}} />
    </>
  );
}

/** Mention obligatoire quand le badge reCAPTCHA est masqué. */
export function RecaptchaNotice({ text }: { text: string }) {
  const key = useSiteKey();
  if (!key) return null;
  return <p className="text-center text-[11px] leading-relaxed text-ink-3">{text}</p>;
}
