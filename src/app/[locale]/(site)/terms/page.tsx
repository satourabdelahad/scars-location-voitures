import { getTranslations, setRequestLocale } from "next-intl/server";
import { RichText } from "@/components/rich-text";
import { defaultPageText } from "@/lib/site-page-defaults";
import { getSiteSettings, pageText } from "@/server/site-settings";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "Footer" }))("terms") };
}

/** Page « terms » du site public : texte modifiable dans Site public. */
export default async function Page({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, settings] = await Promise.all([getTranslations("Footer"), getSiteSettings()]);
  const text = pageText(settings, "terms", locale) ?? defaultPageText("terms", locale);
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="display-md text-4xl text-ink sm:text-5xl">{t("terms")}</h1>
      <RichText text={text} className="mt-8" />
    </div>
  );
}
