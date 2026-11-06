import { Compass, History, Target, Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CarArt } from "@/components/car-art";
import { RichText } from "@/components/rich-text";
import { defaultPageText } from "@/lib/site-page-defaults";
import { ABOUT_SECTIONS, type SitePage } from "@/lib/site-pages";
import { getSiteSettings, pageText } from "@/server/site-settings";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "Nav" }))("about") };
}

const ICONS = { who: Users, history: History, mission: Target, vision: Compass } as const;

/** À propos : Qui nous sommes, Historique, Mission, Vision (textes modifiables dans Site public). */
export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, settings] = await Promise.all([getTranslations("About"), getSiteSettings()]);
  const text = (s: (typeof ABOUT_SECTIONS)[number]) => {
    const page = `about_${s}` as SitePage;
    return pageText(settings, page, locale) ?? defaultPageText(page, locale);
  };
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="grid items-end gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h1 className="display max-w-[16ch] text-[clamp(2.4rem,5vw,4.2rem)] text-ink">{t("title")}</h1>
          <RichText text={text("who")} className="mt-6 max-w-[62ch] text-lg" />
        </div>
        <CarArt category="van" color="#1f6f5c" className="w-full max-w-lg" />
      </div>
      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {(["history", "mission", "vision"] as const).map((s) => {
          const Icon = ICONS[s];
          return (
            <section key={s} className="rounded-[22px] border border-mist bg-paper p-7">
              <h2 className="flex items-center gap-2.5 text-lg font-bold text-ink">
                <span className="grid size-9 place-items-center rounded-xl bg-majorelle-soft text-majorelle"><Icon className="size-5" /></span>
                {t(`section_${s}`)}
              </h2>
              <RichText text={text(s)} className="mt-4 text-[15px]" />
            </section>
          );
        })}
      </div>
    </div>
  );
}
