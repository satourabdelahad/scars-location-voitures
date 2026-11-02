"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { registerAction } from "@/server/actions/auth";

export function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(registerAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      {state?.error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{t(`errors.${state.error}` as "errors.generic")}</p>}
      <Field label={t("name")} required>{(p) => <Input {...p} name="name" autoComplete="name" required minLength={2} />}</Field>
      <Field label={t("email")} required>{(p) => <Input {...p} name="email" type="email" autoComplete="email" dir="ltr" required />}</Field>
      <Field label={t("password")} required hint={t("setPasswordBody")}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={10} />}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>{t("submitRegister")}</Button>
      <p className="pt-2 text-center text-sm text-ink-3">
        {t("haveAccount")} <Link href="/login" className="font-semibold text-majorelle hover:underline">{t("login")}</Link>
      </p>
    </form>
  );
}
