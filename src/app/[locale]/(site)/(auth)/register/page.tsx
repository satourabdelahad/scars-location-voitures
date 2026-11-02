import { getTranslations, setRequestLocale } from "next-intl/server";
import { socialProviders } from "@/auth";
import { AuthShell } from "../auth-shell";
import { SocialButtons } from "../social-buttons";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({ params, searchParams }: PageProps<"/[locale]/register">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("Auth");
  const callbackUrl = typeof sp.callbackUrl === "string" ? sp.callbackUrl : undefined;
  return (
    <AuthShell title={t("registerTitle")} subtitle={t("registerSubtitle")}>
      <SocialButtons enabled={socialProviders} callbackUrl={callbackUrl} />
      <div className="my-7 flex items-center gap-4 text-xs font-medium text-ink-3">
        <span className="h-px flex-1 bg-mist-2" />
        {t("or")}
        <span className="h-px flex-1 bg-mist-2" />
      </div>
      <RegisterForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
