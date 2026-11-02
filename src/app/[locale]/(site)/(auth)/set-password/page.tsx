import { setRequestLocale } from "next-intl/server";
import { SetPasswordForm } from "./set-password-form";

export default async function SetPasswordPage({ params, searchParams }: PageProps<"/[locale]/set-password">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const token = (await searchParams).token;
  return <SetPasswordForm token={typeof token === "string" ? token : ""} />;
}
