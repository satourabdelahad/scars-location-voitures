"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

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
  if (!SITE_KEY || typeof window === "undefined") return "";
  const g = await waitForGrecaptcha();
  if (!g) return "";
  try {
    return await g.execute(SITE_KEY, { action });
  } catch {
    return "";
  }
}

/** Charge le script reCAPTCHA v3 (une seule fois par page) quand la clé du site est configurée. */
export function RecaptchaScript() {
  if (!SITE_KEY) return null;
  return <Script src={`https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`} strategy="afterInteractive" />;
}

/**
 * Champ caché "recaptcha" pour les formulaires envoyés par une action serveur.
 * Le jeton est valable 2 minutes et ne sert qu'une fois : il est renouvelé régulièrement
 * et après chaque envoi (changer `refreshKey`).
 */
export function RecaptchaField({ action, refreshKey }: { action: string; refreshKey?: unknown }) {
  const [token, setToken] = useState("");
  const refresh = useCallback(() => {
    getRecaptchaToken(action).then(setToken);
  }, [action]);
  useEffect(() => {
    if (!SITE_KEY) return;
    refresh();
    const id = setInterval(refresh, 90_000);
    return () => clearInterval(id);
  }, [refresh, refreshKey]);
  if (!SITE_KEY) return null;
  return (
    <>
      <RecaptchaScript />
      <input type="hidden" name="recaptcha" value={token} />
    </>
  );
}

/** Mention obligatoire quand le badge reCAPTCHA est masqué. */
export function RecaptchaNotice({ text }: { text: string }) {
  if (!SITE_KEY) return null;
  return <p className="text-center text-[11px] leading-relaxed text-ink-3">{text}</p>;
}
