"use client";

import { usePendingProgress } from "@/lib/use-pending-progress";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { setPasswordAction } from "@/server/actions/auth";

/** Utilisée pour l'invitation d'un gestionnaire et pour la réinitialisation de mot de passe. */
export function SetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(setPasswordAction, undefined);
  usePendingProgress(pending);
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="display-md text-3xl text-ink">{t("setPasswordTitle")}</h1>
      <p className="mt-3 text-ink-3">{t("setPasswordBody")}</p>
      {state?.ok ? (
        <div className="mt-8 space-y-6">
          <p role="status" className="rounded-xl bg-palm-soft px-4 py-3 text-sm font-medium text-palm">{t("passwordSet")}</p>
          <Button asChild size="lg" className="w-full"><Link href="/login">{t("login")}</Link></Button>
        </div>
      ) : (
        <form action={action} className="mt-8 space-y-4">
          <input type="hidden" name="token" value={token} />
          {state?.error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{t(`errors.${state.error}` as "errors.generic")}</p>}
          <Field label={t("newPassword")} required>{(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={10} />}</Field>
          <Field label={t("confirmPassword")} required>{(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" required minLength={10} />}</Field>
          <Button type="submit" size="lg" className="w-full" loading={pending}>{t("setPasswordSubmit")}</Button>
        </form>
      )}
    </div>
  );
}
