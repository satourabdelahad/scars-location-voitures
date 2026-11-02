import "../globals.css";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { routing } from "@/i18n/routing";
import { localeMeta, type Locale } from "@/i18n/config";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: { default: t("title"), template: `%s · Dizy Cars` },
    description: t("description"),
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l === "ary" ? "ar-MA" : l, `/${l}`])),
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1322" },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const meta = localeMeta[locale as Locale];
  const theme = (await cookies()).get("SCAR_THEME")?.value === "dark" ? "dark" : "light";

  return (
    <html lang={locale === "ary" ? "ar-MA" : locale} dir={meta.dir} data-theme={theme} suppressHydrationWarning>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          {children}
          <Toaster position={meta.dir === "rtl" ? "bottom-left" : "bottom-right"} richColors closeButton dir={meta.dir} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
