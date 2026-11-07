import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { publicSite } from "@/server/public-site";
import { AgencyCard } from "@/components/agency-card";

export async function generateMetadata({ params }: PageProps<"/[locale]/agencies">) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "Nav" }))("agencies") };
}

/** Nos agences (seulement quand il y en a plusieurs ; sinon la page Contact suffit). */
export default async function AgenciesPage({ params }: PageProps<"/[locale]/agencies">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { agencies, multiAgency } = await publicSite();
  if (!multiAgency) redirect({ href: "/contact", locale });
  const t = await getTranslations("Contact");
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h1 className="display-md text-4xl text-ink sm:text-5xl">{t("agenciesTitle")}</h1>
      <p className="mt-3 max-w-xl text-ink-3">{t("subtitle")}</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agencies.map((a) => <AgencyCard key={a.id} a={a} />)}
      </ul>
    </div>
  );
}

