"use client";

import { usePendingProgress } from "@/lib/use-pending-progress";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { loginAction } from "@/server/actions/auth";

const KNOWN = ["invalid", "disabled", "staff", "OAuthAccountNotLinked", "server", "locked", "totp_invalid"];

export function LoginForm({ callbackUrl, initialError }: { callbackUrl?: string; initialError?: string }) {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(loginAction, initialError ? { error: initialError } : undefined);
  usePendingProgress(pending);
  // Champs contrôlés : ils restent remplis quand on demande ensuite le code de double authentification.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const needsCode = state?.error === "totp_required" || state?.error === "totp_invalid";
  const error =
    state?.error && state.error !== "totp_required"
      ? KNOWN.includes(state.error)
        ? t(`errors.${state.error}` as "errors.invalid")
        : t("errors.generic")
      : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <div className={needsCode ? "hidden" : "space-y-4"}>
        <Field label={t("email")} required>
          {(p) => <Input {...p} name="email" type="email" autoComplete="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label={t("password")} required>
          {(p) => (
            <Input {...p} name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-majorelle hover:underline">{t("forgot")}</Link>
        </div>
      </div>

      {needsCode && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-majorelle/25 bg-majorelle-soft px-4 py-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-majorelle" />
            <div>
              <p className="text-sm font-semibold text-ink">{t("totpTitle")}</p>
              <p className="mt-0.5 text-sm text-ink-2">{t("totpHint")}</p>
            </div>
          </div>
          <Field label={t("totpCode")} required>
            {(p) => (
              <Input
                {...p}
                name="code"
                autoFocus
                autoComplete="one-time-code"
                inputMode="text"
                dir="ltr"
                maxLength={9}
                placeholder="123456"
                className="text-center font-mono text-lg tracking-[0.3em]"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            )}
          </Field>
          <button
            type="button"
            className="text-sm font-medium text-ink-3 hover:text-ink"
            onClick={() => {
              setCode("");
              setPassword("");
              window.location.reload();
            }}
          >
            ← {t("totpBack")}
          </button>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" loading={pending}>{needsCode ? t("totpSubmit") : t("submitLogin")}</Button>
      {!needsCode && (
        <p className="pt-2 text-center text-sm text-ink-3">
          {t("noAccount")}{" "}
          <Link href={`/register${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`} className="font-semibold text-majorelle hover:underline">{t("register")}</Link>
        </p>
      )}
    </form>
  );
}
