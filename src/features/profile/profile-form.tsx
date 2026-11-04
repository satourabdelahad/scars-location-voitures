"use client";

import { Camera, KeyRound, PartyPopper, Save, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { CityCombobox } from "@/components/ui/city-combobox";
import { PhoneInput } from "@/components/ui/phone-input";
import { useRouter } from "@/i18n/navigation";
import { ACCEPT_IMAGES, uploadFile } from "@/lib/upload-client";
import { changeMyPassword, updateMyProfile } from "@/server/actions/profile";
import { ManagerAvatar } from "@/features/managers/manager-avatar";
import type { Role } from "@/db/schema";

type Values = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  city: string;
  maritalStatus: "" | "married" | "widowed" | "single";
  /** Client */
  civility: "" | "male" | "female";
  firstName: string;
  lastName: string;
  birthDate: string;
  licenseNumber: string;
};

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-mist py-8 first:pt-0 last:border-0 grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {hint && <p className="mt-1 text-sm text-ink-3">{hint}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

/** "Mon profil" : chaque utilisateur modifie ses propres informations, sa photo et son mot de passe. */
export function ProfileForm({
  role,
  initial,
  photoUrl: initialPhoto,
  displayName,
  readOnly = [],
  hasPassword,
  welcome = false,
}: {
  role: Role;
  initial: Partial<Values>;
  photoUrl: string | null;
  displayName: string;
  /** Informations visibles mais gérées par l'administrateur (gestionnaire) */
  readOnly?: { label: string; value: ReactNode }[];
  hasPassword: boolean;
  /** Première visite après l'invitation : bandeau d'accueil, formulaire à compléter */
  welcome?: boolean;
}) {
  const t = useTranslations("Profile");
  const tm = useTranslations("Managers");
  const td = useTranslations("Documents");
  const te = useTranslations("Errors");
  const e = useTranslations("Enums");
  const router = useRouter();
  const [v, setV] = useState<Values>({
    name: "",
    email: "",
    phone: "",
    whatsapp: "",
    city: "",
    maritalStatus: "",
    civility: "",
    firstName: "",
    lastName: "",
    birthDate: "",
    licenseNumber: "",
    ...initial,
  });
  const [photo, setPhoto] = useState<{ publicId: string; url: string } | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement | null>(null);
  const photoUrl = photo === undefined ? initialPhoto : (photo?.url ?? null);
  const [first, ...rest] = displayName.split(" ");
  const set = <K extends keyof Values>(k: K, value: Values[K]) => setV((s) => ({ ...s, [k]: value }));
  const msg = (code?: string) => (code ? (["passwordWrong", "passwordWeak", "passwordMismatch"].includes(code) ? t(code as "passwordWrong") : te(code as "required")) : undefined);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(file, "avatar");
      setPhoto({ publicId: up.publicId, url: up.url });
    } catch (x) {
      const code = (x as Error).message;
      toast.error(code === "too_big" ? td("tooBig") : code === "bad_type" ? td("badType") : code === "cloudinary_not_configured" ? td("notConfigured") : te("unknown"));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  function save(ev: React.FormEvent) {
    ev.preventDefault();
    setErrors({});
    const data =
      role === "manager"
        ? { phone: v.phone, whatsapp: v.whatsapp, city: v.city, maritalStatus: v.maritalStatus || null }
        : role === "admin"
          ? { name: v.name, email: v.email, phone: v.phone }
          : {
              civility: v.civility,
              firstName: v.firstName,
              lastName: v.lastName,
              phone: v.phone,
              whatsapp: v.whatsapp,
              city: v.city,
              birthDate: v.birthDate,
              licenseNumber: v.licenseNumber,
            };
    start(async () => {
      const r = await updateMyProfile({ data, photo: photo === undefined ? undefined : photo && { publicId: photo.publicId } });
      if (r.ok) {
        toast.success(t("saved"));
        setPhoto(undefined);
        router.refresh();
      } else {
        if (r.fieldErrors) setErrors(r.fieldErrors);
        toast.error(te(r.error as "unknown"));
      }
    });
  }



  return (
    <div className="space-y-4">
      {welcome && (
        <div className="flex items-start gap-3 rounded-2xl border border-palm/30 bg-palm-soft px-5 py-4">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-palm" />
          <div>
            <p className="font-semibold text-ink">{t("welcomeTitle")}</p>
            <p className="mt-1 text-sm text-ink-2">{t("welcomeBody")}</p>
          </div>
        </div>
      )}
      <form onSubmit={save} noValidate className="rounded-2xl border border-mist bg-paper p-6 sm:p-8">
        <Card title={tm("photo")} hint={tm("photoHint")}>
          <div className="flex items-center gap-5">
            <ManagerAvatar photoUrl={photoUrl} firstName={first || "?"} lastName={rest.join(" ")} size="lg" />
            <div className="flex flex-wrap gap-2">
              <input ref={input} type="file" accept={ACCEPT_IMAGES} className="sr-only" tabIndex={-1} onChange={(x) => onPhoto(x.target.files?.[0])} />
              <Button type="button" size="sm" variant="outline" loading={uploading} onClick={() => input.current?.click()}>
                <Camera />
                {photoUrl ? tm("photoChange") : tm("photoAdd")}
              </Button>
              {photoUrl && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setPhoto(null)}>
                  <X />
                  {tm("photoRemove")}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card title={t("infos")}>
          <div className="grid gap-5 sm:grid-cols-2">
            {role === "client" && (
              <>
                <Field label={tm("civility")} className="sm:col-span-2">
                  {(p) => (
                    <Select {...p} value={v.civility} onChange={(x) => set("civility", x.target.value as Values["civility"])}>
                      <option value="">—</option>
                      {(["male", "female"] as const).map((c) => <option key={c} value={c}>{e(`civility.${c}`)}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label={tm("firstName")} required error={msg(errors.firstName)}>
                  {(p) => <Input {...p} autoFocus={welcome} value={v.firstName} onChange={(x) => set("firstName", x.target.value)} autoComplete="given-name" />}
                </Field>
                <Field label={tm("lastName")} required error={msg(errors.lastName)}>
                  {(p) => <Input {...p} value={v.lastName} onChange={(x) => set("lastName", x.target.value)} autoComplete="family-name" />}
                </Field>
              </>
            )}
            {role === "admin" && (
              <Field label={t("name")} required error={msg(errors.name)}>
                {(p) => <Input {...p} value={v.name} onChange={(x) => set("name", x.target.value)} autoComplete="name" />}
              </Field>
            )}
            {role === "admin" && (
              <Field label={tm("email")} required error={msg(errors.email)}>
                {(p) => <Input {...p} type="email" dir="ltr" value={v.email} onChange={(x) => set("email", x.target.value)} autoComplete="email" />}
              </Field>
            )}
            <Field label={tm("phone")} required={role === "manager"} error={msg(errors.phone)}>
              {(p) => <PhoneInput {...p} value={v.phone} onChange={(x) => set("phone", x)} />}
            </Field>
            {role === "client" && (
              <>
                <Field label={tm("whatsapp")} error={msg(errors.whatsapp)}>
                  {(p) => <PhoneInput {...p} value={v.whatsapp} onChange={(x) => set("whatsapp", x)} />}
                </Field>
                <Field label={tm("city")} error={msg(errors.city)}>
                  {(p) => <CityCombobox {...p} value={v.city} onChange={(c) => set("city", c)} />}
                </Field>
                <Field label={tm("birthDate")} error={msg(errors.birthDate)}>
                  {(p) => <Input {...p} type="date" value={v.birthDate} onChange={(x) => set("birthDate", x.target.value)} />}
                </Field>
                <Field label={t("licenseNumber")} error={msg(errors.licenseNumber)}>
                  {(p) => <Input {...p} dir="ltr" value={v.licenseNumber} onChange={(x) => set("licenseNumber", x.target.value)} />}
                </Field>
              </>
            )}
            {role === "manager" && (
              <>
                <Field label={tm("whatsapp")} required error={msg(errors.whatsapp)}>
                  {(p) => <PhoneInput {...p} value={v.whatsapp} onChange={(x) => set("whatsapp", x)} />}
                </Field>
                <Field label={tm("city")} required error={msg(errors.city)}>
                  {(p) => <CityCombobox {...p} value={v.city} onChange={(c) => set("city", c)} />}
                </Field>
                <Field label={tm("maritalStatus")}>
                  {(p) => (
                    <Select {...p} value={v.maritalStatus} onChange={(x) => set("maritalStatus", x.target.value as Values["maritalStatus"])}>
                      <option value="">—</option>
                      {(["single", "married", "widowed"] as const).map((m) => <option key={m} value={m}>{e(`marital.${m}`)}</option>)}
                    </Select>
                  )}
                </Field>
              </>
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <Button type="submit" loading={pending} disabled={uploading}>
              <Save />
              {tm("saveChanges")}
            </Button>
          </div>
        </Card>

        {readOnly.length > 0 && (
          <Card title={t("managedByAdmin")} hint={t("managedByAdminHint")}>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {readOnly.map((r) => (
                <div key={r.label}>
                  <dt className="text-xs font-medium text-ink-3">{r.label}</dt>
                  <dd className="mt-1 rounded-[10px] bg-chalk px-3 py-2.5 text-[15px] text-ink-3">{r.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </form>

      <PasswordForm hasPassword={hasPassword} />
    </div>
  );
}

/** Changement de mot de passe (Mon profil, pour tous les rôles). */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("Profile");
  const te = useTranslations("Errors");
  const ta = useTranslations("Auth");
  const router = useRouter();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwPending, startPw] = useTransition();
  const msg = (code?: string) => (code ? (["passwordWrong", "passwordWeak", "passwordMismatch"].includes(code) ? t(code as "passwordWrong") : te(code as "required")) : undefined);

  function savePassword(ev: React.FormEvent) {
    ev.preventDefault();
    setPwErrors({});
    startPw(async () => {
      const r = await changeMyPassword(pw);
      if (r.ok) {
        toast.success(t("passwordChanged"));
        setPw({ current: "", next: "", confirm: "" });
        router.refresh();
      } else {
        if (r.fieldErrors) setPwErrors(r.fieldErrors);
        else toast.error(te(r.error as "unknown"));
      }
    });
  }
  return (
    <form onSubmit={savePassword} noValidate className="rounded-2xl border border-mist bg-paper p-6 sm:p-8">
        <Card title={t("password")} hint={ta("errors.passwordWeak")}>
          <div className="grid gap-5 sm:grid-cols-3">
            {hasPassword && (
              <Field label={t("currentPassword")} required error={msg(pwErrors.current)}>
                {(p) => <Input {...p} type="password" autoComplete="current-password" value={pw.current} onChange={(x) => setPw((s) => ({ ...s, current: x.target.value }))} />}
              </Field>
            )}
            <Field label={t("newPassword")} required error={msg(pwErrors.next)}>
              {(p) => <Input {...p} type="password" autoComplete="new-password" value={pw.next} onChange={(x) => setPw((s) => ({ ...s, next: x.target.value }))} />}
            </Field>
            <Field label={t("confirmPassword")} required error={msg(pwErrors.confirm)}>
              {(p) => <Input {...p} type="password" autoComplete="new-password" value={pw.confirm} onChange={(x) => setPw((s) => ({ ...s, confirm: x.target.value }))} />}
            </Field>
          </div>
          <div className="mt-6 flex justify-end">
            <Button type="submit" variant="outline" loading={pwPending} disabled={!pw.next}>
              <KeyRound />
              {t("changePassword")}
            </Button>
          </div>
        </Card>
      </form>
  );
}
