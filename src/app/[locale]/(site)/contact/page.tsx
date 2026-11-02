import { Clock, MessageCircle, Phone, Plane } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAgencies } from "@/server/queries/cars";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "Contact" }))("title") };
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Contact");
  const agencies = await listAgencies();
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h1 className="display-md text-4xl text-ink sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-xl text-ink-3">{t("subtitle")}</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agencies.map((a) => (
          <li key={a.id} className="flex flex-col rounded-[22px] border border-mist bg-paper p-6">
            <p className="display-md text-2xl text-ink">{a.city}</p>
            <p className="mt-1 flex items-center gap-2 font-semibold text-ink-2">
              {a.isAirport && <Plane className="size-4 text-majorelle" aria-label={t("airport")} />}
              {a.name}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-3">{a.address}</p>
            <p className="mt-3 flex items-center gap-2 text-sm text-ink-3"><Clock className="size-4" />{t("hours")}</p>
            {a.phone && (
              <div className="mt-6 flex gap-2">
                <a href={`https://wa.me/${a.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-palm text-sm font-semibold text-white hover:brightness-110">
                  <MessageCircle className="size-4" />{t("whatsapp")}
                </a>
                <a href={`tel:${a.phone}`} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-mist-2 text-sm font-semibold text-ink hover:border-ink-3">
                  <Phone className="size-4" />{t("call")}
                </a>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
