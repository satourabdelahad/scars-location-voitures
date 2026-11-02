import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth, socialProviders } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { homeForRole } from "@/server/guards";
import { AuthShell } from "../auth-shell";
import { SocialButtons } from "../social-buttons";
import { LoginForm } from "./login-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "Auth" }))("loginTitle") };
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const session = await auth();
  if (session?.user) redirect({ href: homeForRole(session.user.role), locale });
  const t = await getTranslations("Auth");
  const callbackUrl = typeof sp.callbackUrl === "string" ? sp.callbackUrl : undefined;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <AuthShell title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      <SocialButtons enabled={socialProviders} callbackUrl={callbackUrl} />
      <div className="my-7 flex items-center gap-4 text-xs font-medium text-ink-3">
        <span className="h-px flex-1 bg-mist-2" />
        {t("or")}
        <span className="h-px flex-1 bg-mist-2" />
      </div>
      <LoginForm callbackUrl={callbackUrl} initialError={error} />
    </AuthShell>
  );
}
