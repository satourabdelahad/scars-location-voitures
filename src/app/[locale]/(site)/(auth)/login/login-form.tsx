"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { loginAction } from "@/server/actions/auth";

const KNOWN = ["invalid", "disabled", "staff", "OAuthAccountNotLinked"];

export function LoginForm({ callbackUrl, initialError }: { callbackUrl?: string; initialError?: string }) {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(loginAction, initialError ? { error: initialError } : undefined);
  const error = state?.error ? (KNOWN.includes(state.error) ? t(`errors.${state.error}` as "errors.invalid") : t("errors.generic")) : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <Field label={t("email")} required>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" dir="ltr" required />}
      </Field>
      <Field label={t("password")} required>
        {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-majorelle hover:underline">{t("forgot")}</Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>{t("submitLogin")}</Button>
      <p className="pt-2 text-center text-sm text-ink-3">
        {t("noAccount")}{" "}
        <Link href={`/register${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`} className="font-semibold text-majorelle hover:underline">{t("register")}</Link>
      </p>
    </form>
  );
}
