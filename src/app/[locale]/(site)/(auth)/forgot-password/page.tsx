"use client";

import { usePendingProgress } from "@/lib/use-pending-progress";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { forgotPasswordAction } from "@/server/actions/auth";

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(forgotPasswordAction, undefined);
  usePendingProgress(pending);
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="display-md text-3xl text-ink">{t("forgotTitle")}</h1>
      <p className="mt-3 text-ink-3">{t("forgotBody")}</p>
      {state?.ok ? (
        <p role="status" className="mt-8 rounded-xl bg-palm-soft px-4 py-3 text-sm font-medium text-palm">{t("forgotSent")}</p>
      ) : (
        <form action={action} className="mt-8 space-y-4">
          <Field label={t("email")} required>{(p) => <Input {...p} name="email" type="email" autoComplete="email" dir="ltr" required />}</Field>
          <Button type="submit" size="lg" className="w-full" loading={pending}>{t("forgotSubmit")}</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-semibold text-majorelle hover:underline">{t("login")}</Link></p>
    </div>
  );
}
