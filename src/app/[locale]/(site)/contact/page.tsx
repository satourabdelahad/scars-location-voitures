import { Mail, MapPin, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AgencyCard } from "@/components/agency-card";
import { ContactForm } from "@/features/public/contact-form";
import { Link } from "@/i18n/navigation";
import { publicSite, waLink } from "@/server/public-site";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "Contact" }))("title") };
}

/** Contact : coordonnées principales (Site public), carte de l'adresse et formulaire. */
export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Contact");
  const { contact, agencies, multiAgency } = await publicSite();
  const items = [
    contact.address && { icon: <MapPin />, label: t("address"), value: contact.address, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}` },
    contact.email && { icon: <Mail />, label: t("email"), value: contact.email, href: `mailto:${contact.email}` },
    contact.phone && { icon: <Phone />, label: t("phone"), value: contact.phone, href: `tel:${contact.phone.replace(/\s/g, "")}`, ltr: true },
    contact.whatsapp && { icon: <WhatsAppIcon />, label: "WhatsApp", value: contact.whatsapp, href: waLink(contact.whatsapp), ltr: true },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string; href: string; ltr?: boolean }[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h1 className="display-md text-4xl text-ink sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-xl text-ink-3">{t("contactSubtitle")}</p>
      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((x) => (
              <li key={x.label} className={x.label === t("address") ? "sm:col-span-2" : undefined}>
                <a href={x.href} target={x.href.startsWith("http") ? "_blank" : undefined} rel="noopener" className="flex items-start gap-3 rounded-2xl border border-mist bg-paper p-4 hover:border-majorelle">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-majorelle-soft text-majorelle [&_svg]:size-5">{x.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-wide text-ink-3 uppercase">{x.label}</span>
                    <span dir={x.ltr ? "ltr" : undefined} className="block font-semibold break-words text-ink">{x.value}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {contact.address && (
            <iframe
              title={t("mapTitle")}
              src={`https://www.google.com/maps?q=${encodeURIComponent(contact.address)}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-80 w-full rounded-[22px] border border-mist bg-chalk"
            />
          )}
        </div>
        <ContactForm />
      </div>

      {agencies.length > 0 && (
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="display-md text-2xl text-ink sm:text-3xl">{multiAgency ? t("agenciesTitle") : t("ourAgency")}</h2>
            {multiAgency && agencies.length > 3 && <Link href="/agencies" className="text-sm font-semibold text-majorelle hover:underline">{t("allAgencies")}</Link>}
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agencies.slice(0, 3).map((a) => <AgencyCard key={a.id} a={a} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
