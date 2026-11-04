"use client";

import { CarFront, Eye, Mail, RotateCcw, Save, Send, UserPlus, CalendarCheck, UserRoundPlus, MessageSquareShare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { HtmlEditor } from "@/components/html-editor";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { TEMPLATE_VARIABLES, type TemplateKey } from "@/lib/email-template-defs";
import { cn, formatDateTime } from "@/lib/utils";
import { localeMeta, locales, type Locale } from "@/i18n/config";
import { Flag } from "@/components/flags";
import { previewEmailTemplate, resetEmailTemplate, saveEmailTemplate, sendTestEmailTemplate } from "@/server/actions/email-templates";

type Version = { subject: string; html: string; custom: boolean; updatedAt: string | null };
type Tpl = { key: TemplateKey; byLocale: Record<string, Version> };
const ICONS: Record<TemplateKey, typeof Mail> = { manager_invite: UserPlus, client_invite: UserRoundPlus, car_created: CarFront, reservation_created: CalendarCheck, prospect_followup: MessageSquareShare };

export function TemplatesEditor({ templates, locale }: { templates: Tpl[]; locale: string }) {
  const t = useTranslations("Admin");
  const [active, setActive] = useState<TemplateKey>(templates[0].key);
  // Langue en cours d'édition : celle de l'interface par défaut.
  const [lang, setLang] = useState<string>((locales as readonly string[]).includes(locale) ? locale : "fr");
  const current = templates.find((x) => x.key === active)!;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[260px_1fr]">
      <nav aria-label={t("templates")} className="rounded-2xl border border-mist bg-paper p-2">
        <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">{t("templates")}</p>
        {templates.map((tpl) => {
          const Icon = ICONS[tpl.key];
          return (
            <button
              key={tpl.key}
              type="button"
              onClick={() => setActive(tpl.key)}
              aria-current={active === tpl.key ? "true" : undefined}
              className={cn("flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start transition-colors", active === tpl.key ? "bg-majorelle-soft" : "hover:bg-chalk")}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", active === tpl.key ? "text-majorelle" : "text-ink-3")} />
              <span className="min-w-0">
                <span className={cn("block text-sm font-semibold", active === tpl.key ? "text-majorelle" : "text-ink")}>{t(`tpl.${tpl.key}.name`)}</span>
                <span className="block text-xs text-ink-3">{t(`tpl.${tpl.key}.when`)}</span>
              </span>
            </button>
          );
        })}
      </nav>
      <div className="min-w-0 space-y-3">
        <div role="tablist" aria-label={t("language")} className="scroll-thin flex gap-1 overflow-x-auto rounded-[12px] border border-mist bg-paper p-1">
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={cn("relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors", lang === l ? "bg-ink text-chalk" : "text-ink-2 hover:bg-chalk")}
            >
              <Flag locale={l} className="h-3.5 w-5" />
              {localeMeta[l].native}
              {current.byLocale[l]?.custom && <span className="size-1.5 rounded-full bg-palm" aria-label={t("custom")} />}
            </button>
          ))}
        </div>
        {/* key : on repart des valeurs enregistrées à chaque changement de modèle ou de langue */}
        <TemplateForm key={`${active}-${lang}`} tplKey={active} lang={lang} version={current.byLocale[lang]} locale={locale} />
      </div>
    </div>
  );
}

function TemplateForm({ tplKey, lang, version: tpl, locale }: { tplKey: TemplateKey; lang: string; version: Version; locale: string }) {
  const t = useTranslations("Admin");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [subject, setSubject] = useState(tpl.subject);
  const [html, setHtml] = useState(tpl.html);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const variables = TEMPLATE_VARIABLES[tplKey].map((v) => ({ key: v.key, label: t.has(`vars.${v.key}`) ? t(`vars.${v.key}` as "vars.prenom") : v.key }));
  const dirty = subject !== tpl.subject || html !== tpl.html;

  const run = (fn: () => Promise<void>) => start(fn);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-mist bg-paper p-6 sm:p-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-ink">{t(`tpl.${tplKey}.name`)}</h2>
            <p className="mt-0.5 text-sm text-ink-3">{t(`tpl.${tplKey}.recipients`)}</p>
          </div>
          {tpl.custom ? (
            <Badge tone="info">{tpl.updatedAt ? t("customSince", { date: formatDateTime(tpl.updatedAt, locale) }) : t("custom")}</Badge>
          ) : (
            <Badge tone="neutral">{t("default")}</Badge>
          )}
        </div>

        <div className="space-y-5">
          <p className="-mt-1 text-xs text-ink-3">{t("languageHint", { language: localeMeta[lang as Locale].native })}</p>
          <Field label={t("subject")} required error={errors.subject ? te(errors.subject as "required") : undefined}>
            {(p) => <Input {...p} value={subject} onChange={(e) => setSubject(e.target.value)} />}
          </Field>
          <div className="-mt-3 flex flex-wrap gap-1.5">
            {variables
              .filter((v) => !v.key.startsWith("bouton_") && !v.key.startsWith("lien_"))
              .slice(0, 10)
              .map((v) => (
                <button key={v.key} type="button" onClick={() => setSubject((s) => `${s}{{${v.key}}}`)} className="rounded-full bg-chalk px-2.5 py-1 font-mono text-[11px] text-ink-2 hover:bg-mist" dir="ltr">
                  {`{{${v.key}}}`}
                </button>
              ))}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink">{t("body")}</p>
            <HtmlEditor key={lang} dir={localeMeta[lang as Locale].dir} value={html} onChange={setHtml} variables={variables} invalid={Boolean(errors.html)} minHeight={320} />
            <p className="mt-2 text-xs text-ink-3">{t("bodyHint")}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-mist pt-5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              loading={pending}
              onClick={() =>
                run(async () => {
                  const r = await previewEmailTemplate({ key: tplKey, locale: lang, subject, html });
                  if (r.ok) setPreview(r.data!);
                  else toast.error(te(r.error as "unknown"));
                })
              }
            >
              <Eye />
              {t("preview")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending || dirty}
              title={dirty ? t("saveFirst") : undefined}
              onClick={() =>
                run(async () => {
                  const r = await sendTestEmailTemplate(tplKey, lang);
                  if (r.ok) toast.success(t("testSent", { to: r.data!.to }));
                  else toast.error(te(r.error as "unknown"));
                })
              }
            >
              <Send />
              {t("sendTest")}
            </Button>
            {tpl.custom && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const r = await resetEmailTemplate(tplKey, lang);
                    if (r.ok) {
                      toast.success(t("resetDone"));
                      router.refresh();
                    } else toast.error(te(r.error as "unknown"));
                  })
                }
              >
                <RotateCcw />
                {t("reset")}
              </Button>
            )}
          </div>
          <Button
            type="button"
            loading={pending}
            disabled={!dirty}
            onClick={() =>
              run(async () => {
                setErrors({});
                const r = await saveEmailTemplate({ key: tplKey, locale: lang, subject, html });
                if (r.ok) {
                  toast.success(t("saved"));
                  router.refresh();
                } else {
                  if (r.fieldErrors) setErrors(r.fieldErrors);
                  toast.error(te(r.error as "unknown"));
                }
              })
            }
          >
            <Save />
            {t("save")}
          </Button>
        </div>
      </div>

      {preview && (
        <div className="overflow-hidden rounded-2xl border border-mist bg-paper">
          <div className="flex items-center gap-2 border-b border-mist px-5 py-3 text-sm">
            <Mail className="size-4 text-ink-3" />
            <span className="text-ink-3">{t("subject")} :</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{preview.subject}</span>
          </div>
          <iframe title={t("preview")} srcDoc={preview.html} sandbox="" className="h-[560px] w-full bg-[#f5f6fa]" />
        </div>
      )}
    </section>
  );
}
