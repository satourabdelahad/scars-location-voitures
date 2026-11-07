import { CalendarRange, CarFront, Check, Compass, Home, Plane, ShieldCheck, Smartphone, Target, Wrench } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CarArt } from "@/components/car-art";
import { RichText } from "@/components/rich-text";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Link } from "@/i18n/navigation";
import { defaultPageText } from "@/lib/site-page-defaults";
import { parseCards, type SitePage } from "@/lib/site-pages";
import { publicSite, waLink } from "@/server/public-site";
import { pageText } from "@/server/site-settings";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "Nav" }))("about") };
}

const SERVICE_ICONS = [Plane, Home, CalendarRange, ShieldCheck, Wrench, Smartphone];

/** À propos : présentation, Mission, Vision et Services (textes modifiables dans Site public). */
export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, { settings, contact }] = await Promise.all([getTranslations("About"), publicSite()]);
  const text = (page: SitePage) => pageText(settings, page, locale) ?? defaultPageText(page, locale);
  const services = parseCards(text("about_services"));

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      {/* Présentation */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="text-sm font-semibold tracking-wide text-majorelle uppercase">{t("eyebrow")}</p>
          <h1 className="display mt-3 max-w-[18ch] text-[clamp(2.3rem,5vw,4rem)] text-ink">{t("title")}</h1>
          <RichText text={text("about_who")} className="mt-6 max-w-[62ch] text-lg" />
          <ul className="mt-6 grid gap-2 text-sm font-medium text-ink-2 sm:grid-cols-2">
            {[t("benefit1"), t("benefit2"), t("benefit3"), t("benefit4")].map((b) => (
              <li key={b} className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-palm" />
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/cars" className="inline-flex h-11 items-center gap-2 rounded-xl bg-majorelle px-5 text-sm font-semibold text-white hover:brightness-110">
              <CarFront className="size-4" />
              {t("ctaCars")}
            </Link>
            {contact.whatsapp && (
              <a href={waLink(contact.whatsapp)} target="_blank" rel="noopener" className="inline-flex h-11 items-center gap-2 rounded-xl bg-palm px-5 text-sm font-semibold text-white hover:brightness-110">
                <WhatsAppIcon className="size-4" />
                {t("ctaWhatsapp")}
              </a>
            )}
          </div>
        </div>
        <CarArt category="suv_4x4" color="#1f6f5c" passengers className="w-full max-w-lg justify-self-center" />
      </section>

      {/* Mission et vision */}
      <section className="mt-20 grid gap-4 md:grid-cols-2">
        {([["about_mission", Target, t("section_mission")], ["about_vision", Compass, t("section_vision")]] as const).map(([page, Icon, title]) => (
          <div key={page} className="rounded-[22px] border border-mist bg-paper p-7 sm:p-8">
            <h2 className="flex items-center gap-3 text-xl font-bold text-ink">
              <span className="grid size-10 place-items-center rounded-xl bg-majorelle-soft text-majorelle"><Icon className="size-5" /></span>
              {title}
            </h2>
            <RichText text={text(page)} className="mt-4" />
          </div>
        ))}
      </section>

      {/* Services */}
      <section className="mt-20">
        <h2 className="display-md text-3xl text-ink sm:text-4xl">{t("section_services")}</h2>
        <p className="mt-2 max-w-2xl text-ink-3">{t("servicesSubtitle")}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => {
            const Icon = SERVICE_ICONS[i % SERVICE_ICONS.length];
            return (
              <li key={`${s.title}-${i}`} className="rounded-[22px] border border-mist bg-paper p-6 transition-colors hover:border-majorelle/40">
                <span className="grid size-11 place-items-center rounded-xl bg-saffron/20 text-saffron-ink"><Icon className="size-5" /></span>
                <span className="mt-4 block text-xs font-semibold text-ink-3 tabular">{String(i + 1).padStart(2, "0")}</span>
                {s.title && <h3 className="mt-1 text-lg font-bold text-ink">{s.title}</h3>}
                <RichText text={s.body.map((b) => (b.type === "ul" ? b.items.map((x) => `- ${x}`).join("\n") : b.type === "p" ? b.text : `## ${b.text}`)).join("\n\n")} className="mt-2 text-[15px]" />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Appel à l'action */}
      <section className="mt-20 flex flex-col items-start justify-between gap-6 rounded-[28px] bg-ink p-8 text-chalk sm:flex-row sm:items-center sm:p-10 dark:bg-paper dark:text-ink">
        <div>
          <h2 className="display-md text-2xl sm:text-3xl">{t("ctaTitle")}</h2>
          <p className="mt-2 opacity-75">{t("ctaBody")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/cars" className="inline-flex h-11 items-center gap-2 rounded-xl bg-saffron px-5 text-sm font-bold text-[#141a2e] hover:brightness-105">
            <CarFront className="size-4" />
            {t("ctaCars")}
          </Link>
          {contact.phone && (
            <a href={`tel:${contact.phone.replace(/\s/g, "")}`} dir="ltr" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 px-5 text-sm font-semibold hover:bg-white/10">
              {contact.phone}
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
