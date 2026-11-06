"use client";

import { FileText, Globe, Info, Mail, MapPin, MessageCircle, Phone, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/misc";
import { PhoneInput } from "@/components/ui/phone-input";
import { useRouter } from "@/i18n/navigation";
import { localeMeta, locales } from "@/i18n/config";
import { ABOUT_SECTIONS, SOCIALS, type SitePage } from "@/lib/site-pages";
import { Flag } from "@/components/flags";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { updateSiteSettings } from "@/server/actions/site";

type Settings = {
  contact: { address: string; email: string; phone: string; whatsapp: string; facebook: string; instagram: string; x: string; tiktok: string };
  pages: Partial<Record<SitePage, Record<string, string>>>;
};
type Tab = "contact" | "about" | "terms" | "privacy";

/**
 * Site public : coordonnées affichées en haut du site et sur la page Contact,
 * et textes des pages À propos, Conditions de location et Confidentialité (un texte par langue).
 */
export function SiteSettingsForm({ initial, defaults, uiLocale }: { initial: Settings; defaults: Record<string, Record<SitePage, string>>; uiLocale: string }) {
  const t = useTranslations("Site");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<Tab>("contact");
  const [lang, setLang] = useState(uiLocale);
  const [v, setV] = useState<Settings>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setContact = (k: keyof Settings["contact"], value: string) => setV((s) => ({ ...s, contact: { ...s.contact, [k]: value } }));
  const text = (page: SitePage) => v.pages[page]?.[lang] ?? "";
  const setText = (page: SitePage, value: string) => setV((s) => ({ ...s, pages: { ...s.pages, [page]: { ...(s.pages[page] ?? {}), [lang]: value } } }));

  const save = () =>
    start(async () => {
      setErrors({});
      const r = await updateSiteSettings(v);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        return void toast.error(te(r.error as "unknown"));
      }
      toast.success(tc("saved"));
      router.refresh();
    });

  const tabs: { id: Tab; label: string; Icon: typeof Info }[] = [
    { id: "contact", label: t("tabContact"), Icon: Mail },
    { id: "about", label: t("tabAbout"), Icon: Info },
    { id: "terms", label: t("tabTerms"), Icon: FileText },
    { id: "privacy", label: t("tabPrivacy"), Icon: ShieldCheck },
  ];

  const editor = (page: SitePage, label: string, rows = 8) => (
    <Field key={page} label={label} hint={text(page).trim() ? undefined : t("usingDefault")}>
      {(p) => (
        <div>
          <Textarea {...p} rows={rows} dir={localeMeta[lang as keyof typeof localeMeta]?.dir ?? "ltr"} value={text(page) || defaults[lang]?.[page] || ""} onChange={(e) => setText(page, e.target.value)} />
          {text(page).trim() && (
            <button type="button" onClick={() => setText(page, "")} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-ink-3 hover:text-ink">
              <RotateCcw className="size-3.5" />
              {t("restoreDefault")}
            </button>
          )}
        </div>
      )}
    </Field>
  );

  const langPicker = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="me-1 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2">
        <Globe className="size-4 text-ink-3" />
        {t("language")}
      </span>
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
            lang === l ? "border-majorelle bg-majorelle-soft text-majorelle" : "border-mist text-ink-2 hover:bg-chalk",
          )}
        >
          <Flag locale={l as Locale} className="h-3.5 w-5 rounded-[3px]" />
          {localeMeta[l].label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div role="tablist" className="scroll-thin -mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-mist px-1">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold", tab === id ? "border-majorelle text-majorelle" : "border-transparent text-ink-3 hover:text-ink")}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <Panel className="p-6 sm:p-8">
        {tab === "contact" ? (
          <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
            <p className="text-sm text-ink-3 sm:col-span-2">{t("contactHint")}</p>
            <Field label={t("address")} className="sm:col-span-2" hint={t("addressHint")}>
              {(p) => (
                <div className="relative">
                  <MapPin className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                  <Input {...p} className="ps-9" value={v.contact.address} onChange={(e) => setContact("address", e.target.value)} />
                </div>
              )}
            </Field>
            <Field label={t("email")} error={errors["contact.email"] ? te(errors["contact.email"] as "email") : undefined} hint={t("emailHint")}>
              {(p) => <Input {...p} type="email" dir="ltr" value={v.contact.email} onChange={(e) => setContact("email", e.target.value)} placeholder="contact@dizy-cars.com" />}
            </Field>
            <Field label={t("phone")}>
              {(p) => <PhoneInput {...p} value={v.contact.phone} onChange={(x) => setContact("phone", x)} />}
            </Field>
            <Field label={t("whatsapp")}>
              {(p) => <PhoneInput {...p} value={v.contact.whatsapp} onChange={(x) => setContact("whatsapp", x)} />}
            </Field>
            <h3 className="mt-2 text-sm font-bold text-ink sm:col-span-2">{t("socialTitle")}</h3>
            {SOCIALS.map((k) => (
              <Field key={k} label={t(`social_${k}`)} error={errors[`contact.${k}`] ? te("url") : undefined}>
                {(p) => <Input {...p} type="url" dir="ltr" inputMode="url" placeholder={`https://${k === "x" ? "x" : k}.com/…`} value={v.contact[k]} onChange={(e) => setContact(k, e.target.value)} />}
              </Field>
            ))}
            <h3 className="mt-2 text-sm font-bold text-ink sm:col-span-2">{t("topBarNote")}</h3>
            <div className="grid gap-3 sm:col-span-2">
              {langPicker}
              {editor("topbar_note", t("topBarNoteLabel"), 2)}
            </div>
            <ul className="flex flex-wrap items-center gap-4 rounded-xl bg-chalk px-4 py-3 text-xs text-ink-2 sm:col-span-2">
              <li className="font-semibold text-ink-3">{t("topBarPreview")}</li>
              {v.contact.email && <li className="inline-flex items-center gap-1.5"><Mail className="size-3.5" />{v.contact.email}</li>}
              {v.contact.phone && <li className="inline-flex items-center gap-1.5" dir="ltr"><Phone className="size-3.5" />{v.contact.phone}</li>}
              {v.contact.whatsapp && <li className="inline-flex items-center gap-1.5" dir="ltr"><MessageCircle className="size-3.5" />{v.contact.whatsapp}</li>}
            </ul>
          </div>
        ) : (
          <div className="grid max-w-3xl gap-5">
            <div className="grid gap-3">
              <p className="max-w-xl text-sm text-ink-3">{t("textsHint")}</p>
              {langPicker}
            </div>
            {tab === "about" && ABOUT_SECTIONS.map((s) => editor(`about_${s}` as SitePage, t(`about_${s}`), s === "services" ? 16 : 6))}
            {tab === "terms" && editor("terms", t("tabTerms"), 22)}
            {tab === "privacy" && editor("privacy", t("tabPrivacy"), 22)}
            <p className="text-xs text-ink-3">{t("formatHint")}</p>
          </div>
        )}
        <div className="mt-6 flex justify-end border-t border-mist pt-5">
          <Button onClick={save} loading={pending}>
            <Save />
            {tc("save")}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
