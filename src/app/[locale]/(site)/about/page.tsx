import { getTranslations, setRequestLocale } from "next-intl/server";
import { CarArt } from "@/components/car-art";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "Nav" }))("about") };
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("About");
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="grid items-end gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h1 className="display max-w-[16ch] text-[clamp(2.4rem,5vw,4.2rem)] text-ink">{t("title")}</h1>
          <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-ink-2">{t("body1")}</p>
          <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-ink-2">{t("body2")}</p>
        </div>
        <CarArt category="van" color="#1f6f5c" className="w-full max-w-lg" />
      </div>
      <h2 className="display-md mt-20 text-3xl text-ink">{t("valuesTitle")}</h2>
      <div className="mt-8 grid gap-px overflow-hidden rounded-[22px] border border-mist bg-mist md:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-paper p-7">
            <h3 className="text-lg font-bold text-ink">{t(`value${n}Title`)}</h3>
            <p className="mt-2 leading-relaxed text-ink-3">{t(`value${n}Body`)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
