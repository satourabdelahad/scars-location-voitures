"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { getRecaptchaToken } from "@/components/recaptcha/recaptcha";
import { submitContactForm } from "@/server/actions/site";

/** Formulaire de la page Contact : le message part par email à l'adresse de contact du site. */
export function ContactForm() {
  const t = useTranslations("Contact");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const [pending, start] = useTransition();
  const [v, setV] = useState({ name: "", email: "", phone: "", message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof v, value: string) => setV((s) => ({ ...s, [k]: value }));
  const err = (k: string) => (errors[k] ? (errors[k] === "messageTooShort" ? t("messageTooShort") : te(errors[k] as "required")) : undefined);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setErrors({});
      const r = await submitContactForm(v, await getRecaptchaToken("contact"));
      if (r.ok) setDone(true);
      else {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error === "contact_unavailable" ? t("unavailable") : te(r.error as "unknown"));
      }
    });
  };

  if (done)
    return (
      <div className="flex flex-col items-center rounded-[22px] border border-mist bg-paper p-10 text-center">
        <CheckCircle2 className="size-12 text-palm" />
        <p className="mt-4 text-lg font-bold text-ink">{t("sentTitle")}</p>
        <p className="mt-1 text-sm text-ink-3">{t("sentBody")}</p>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-[22px] border border-mist bg-paper p-6 sm:grid-cols-2 sm:p-8">
      <h2 className="text-xl font-bold text-ink sm:col-span-2">{t("formTitle")}</h2>
      <Field label={t("name")} required error={err("name")}>
        {(p) => <Input {...p} autoComplete="name" value={v.name} onChange={(e) => set("name", e.target.value)} />}
      </Field>
      <Field label={t("email")} required error={err("email")}>
        {(p) => <Input {...p} type="email" dir="ltr" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)} />}
      </Field>
      <Field label={t("phone")} optionalLabel={tc("optional")} className="sm:col-span-2">
        {(p) => <PhoneInput {...p} value={v.phone} onChange={(x) => set("phone", x)} />}
      </Field>
      <Field label={t("message")} required error={err("message")} className="sm:col-span-2">
        {(p) => <Textarea {...p} rows={6} maxLength={4000} value={v.message} onChange={(e) => set("message", e.target.value)} />}
      </Field>
      {/* Champ piège invisible pour les robots */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={v.website} onChange={(e) => set("website", e.target.value)} />
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" size="lg" loading={pending}>
          <Send />
          {t("send")}
        </Button>
      </div>
    </form>
  );
}
