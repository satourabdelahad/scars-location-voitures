"use client";

import Image from "next/image";
import { CheckCircle2, Clock, KeyRound, ShieldCheck, TicketPercent, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { CarArt } from "@/components/car-art";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { CityCombobox } from "@/components/ui/city-combobox";
import { activePromoPercent, promoPrice } from "@/lib/car-promo";
import { extraCost } from "@/lib/pricing";
import { Link, useRouter } from "@/i18n/navigation";
import type { CarCategory } from "@/db/schema";
import { cn, formatDate, formatMoney, rentalDays, todayISO } from "@/lib/utils";
import { checkPromoCode, createReservation } from "@/server/actions/reservations";
import { bookingLoginAction } from "@/server/actions/auth";
import { getRecaptchaToken, RecaptchaScript } from "@/components/recaptcha/recaptcha";
import { SocialButtons } from "../../(auth)/social-buttons";

type Extra = { id: number; name: string; price: number; pricing: "per_day" | "once" };
type Profile = { civility: string; firstName: string; lastName: string; city: string; phone: string; whatsapp: string; idCardNumber: string; licenseNumber: string };
type Props = {
  car: {
    id: string;
    name: string;
    year: number;
    category: CarCategory;
    categoryLabel: string;
    specs: string[];
    colorHex: string;
    dailyPrice: number;
    promoPercent: number | null;
    promoStartsOn: string | null;
    promoEndsOn: string | null;
    deposit: number;
    images: string[];
    description: string | null;
  };
  agencies: { id: number; label: string; address: string }[];
  extras: Extra[];
  driverPricePerDay: number;
  booked: { start: string; end: string }[];
  initial: {
    startDate: string;
    endDate: string;
    pickupTime: string;
    returnTime: string;
    pickupAgencyId: number;
    returnAgencyId: number;
    extras: number[];
    withDriver: boolean;
    acceptTerms: boolean;
  };
  /** Client connecté : ses informations, à compléter (carte d'identité, permis) */
  profile: Profile | null;
  suggestedPromo?: string;
  socialEnabled: Record<string, boolean>;
  terms: ReactNode;
  locale: string;
};

export function BookingForm({ car, agencies, extras, driverPricePerDay, booked, initial, profile, suggestedPromo, socialEnabled, terms, locale }: Props) {
  const t = useTranslations("Booking");
  const te = useTranslations("Errors");
  const tc = useTranslations("Common");
  const tcars = useTranslations("Cars");
  const ta = useTranslations("Auth");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [v, setV] = useState({ ...initial, flightNumber: "", clientNote: "" });
  const [p, setP] = useState<Profile | null>(profile);
  const [identify, setIdentify] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [done, setDone] = useState<{ reference: string; responseHours: number } | null>(null);
  const [photo, setPhoto] = useState(0);

  const days = Math.max(0, rentalDays(v.startDate, v.endDate));
  const chosen = extras.filter((x) => v.extras.includes(x.id));
  const extrasTotal = chosen.reduce((s, x) => s + extraCost(x, days), 0);
  const driverTotal = v.withDriver ? driverPricePerDay * days : 0;
  const carPromo = activePromoPercent(car, v.startDate);
  const dayPrice = promoPrice(car.dailyPrice, carPromo);
  const rental = dayPrice * days;
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; label: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState(false);
  const [checkingPromo, startPromo] = useTransition();
  const discount = promo?.discount ?? 0;
  const total = rental + extrasTotal + driverTotal - discount;

  function applyPromo(code: string, vals: Pick<typeof v, "startDate" | "endDate" | "extras" | "withDriver"> = v) {
    setPromoError(false);
    startPromo(async () => {
      const r = await checkPromoCode({ code, carId: car.id, startDate: vals.startDate, endDate: vals.endDate, extras: vals.extras, withDriver: vals.withDriver });
      if (r.ok) setPromo({ code: r.code, label: r.label, discount: r.discount });
      else {
        setPromo(null);
        setPromoError(true);
      }
    });
  }
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => {
    const next = { ...v, [k]: value };
    setV(next);
    if (promo && ["startDate", "endDate", "extras", "withDriver"].includes(k)) applyPromo(promo.code, next);
  };
  const autoApplied = useRef(false);
  useEffect(() => {
    if (autoApplied.current || !suggestedPromo) return;
    autoApplied.current = true;
    setPromoInput(suggestedPromo);
    applyPromo(suggestedPromo);
  }, [suggestedPromo]); // eslint-disable-line react-hooks/exhaustive-deps
  const conflict = useMemo(() => booked.some((b) => b.start < v.endDate && b.end > v.startDate), [booked, v.startDate, v.endDate]);

  /** Lien de retour après une connexion sociale : les choix de la page sont conservés. */
  const callbackUrl = () => {
    const qs = new URLSearchParams({ agency: String(v.pickupAgencyId), start: v.startDate, end: v.endDate, terms: v.acceptTerms ? "1" : "0", driver: v.withDriver ? "1" : "0" });
    if (v.pickupTime) qs.set("startTime", v.pickupTime);
    if (v.returnTime) qs.set("endTime", v.returnTime);
    if (v.extras.length) qs.set("extras", v.extras.join(","));
    return `/${locale}/book/${car.id}?${qs.toString()}`;
  };

  const err = (k: string) => (errors[k] ? (errors[k] === "minAge21" ? t("minAge") : te(errors[k] as "required")) : undefined);

  /** Envoie la réservation ; guest = nouvelle fiche client (sinon la session ouverte). */
  const send = (guest?: Record<string, unknown>) =>
    start(async () => {
      setErrors({});
      const driver = guest
        ? { driverFirstName: String(guest.firstName ?? ""), driverLastName: String(guest.lastName ?? ""), driverPhone: String(guest.phone ?? "") }
        : p
          ? { driverFirstName: p.firstName, driverLastName: p.lastName, driverPhone: p.phone }
          : {};
      const res = await createReservation(
        { ...v, ...driver, carId: car.id, promoCode: promo?.code },
        await getRecaptchaToken("booking"),
        guest,
        !guest && p ? p : undefined,
      );
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error === "account_exists" ? t("accountExists") : te(res.error as "unknown"));
        if (Object.keys(res.fieldErrors ?? {}).some((k) => k.startsWith("profile."))) document.getElementById("profile")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      setIdentify(false);
      if (res.data!.signedIn) {
        router.push(`/account/reservations/${res.data!.id}?new=1`);
        router.refresh();
      } else {
        setDone({ reference: res.data!.reference, responseHours: res.data!.responseHours });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

  const onReserve = () => {
    if (!v.acceptTerms) {
      setErrors({ acceptTerms: "acceptTerms" });
      document.getElementById("terms-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (p) send();
    else setIdentify(true);
  };

  if (done) {
    return (
      <div className="mt-8 flex flex-col items-center rounded-[26px] border border-mist bg-paper px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-palm-soft text-palm"><CheckCircle2 className="size-8" /></span>
        <h2 className="display-md mt-5 text-3xl text-ink">{t("receivedTitle")}</h2>
        <p className="mt-3 max-w-md text-ink-2">{t("receivedBody", { ref: done.reference, hours: done.responseHours })}</p>
        <p className="mt-3 max-w-md text-sm text-ink-3">{t("existingAccountLogin")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button asChild size="lg"><Link href={`/login?callbackUrl=${encodeURIComponent(`/${locale}/account?tab=reservations`)}`}>{t("loginToFollow")}</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/reservation">{t("backToCars")}</Link></Button>
        </div>
      </div>
    );
  }

  const section = "rounded-[22px] border border-mist bg-paper p-6";
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
      <RecaptchaScript />
      <div className="space-y-6">
        {/* Détails de la voiture */}
        <section className={cn(section, "overflow-hidden p-0")} aria-label={car.name}>
          <div className="relative aspect-[16/9] bg-gradient-to-b from-chalk to-mist/60">
            {car.images[photo] ? (
              <Image src={car.images[photo]} alt={car.name} fill sizes="(min-width:1024px) 720px, 100vw" className="object-cover" priority />
            ) : (
              <CarArt category={car.category} color={car.colorHex} className="absolute inset-x-8 bottom-4 w-[calc(100%-4rem)]" />
            )}
          </div>
          {car.images.length > 1 && (
            <div className="scroll-thin flex gap-2 overflow-x-auto p-3">
              {car.images.map((src, i) => (
                <button key={src} type="button" onClick={() => setPhoto(i)} aria-label={`${car.name} ${i + 1}`} className={cn("relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2", i === photo ? "border-majorelle" : "border-transparent")}>
                  <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="p-6">
            <p className="text-xs font-semibold text-ink-3">{car.categoryLabel}</p>
            <h2 className="mt-1 text-2xl font-extrabold text-ink">{car.name} <span className="font-semibold text-ink-3">{car.year}</span></h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {car.specs.map((s) => <li key={s} className="rounded-full bg-chalk px-3 py-1 text-xs font-semibold text-ink-2">{s}</li>)}
            </ul>
            {car.description && <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-ink-2">{car.description}</p>}
          </div>
        </section>

        {/* Lieu, dates et heures */}
        <fieldset className={section}>
          <legend className="sr-only">{t("stepDates")}</legend>
          <h2 className="mb-5 text-lg font-bold text-ink">{t("stepDates")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("pickupAgency")} required hint={agencies.find((a) => a.id === v.pickupAgencyId)?.address}>
              {(f) => (
                <Select {...f} value={v.pickupAgencyId} onChange={(e) => { set("pickupAgencyId", Number(e.target.value)); if (v.returnAgencyId === v.pickupAgencyId) setV((s) => ({ ...s, pickupAgencyId: Number(e.target.value), returnAgencyId: Number(e.target.value) })); }}>
                  {agencies.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label={t("returnAgency")} required hint={agencies.find((a) => a.id === v.returnAgencyId)?.address}>
              {(f) => (
                <Select {...f} value={v.returnAgencyId} onChange={(e) => set("returnAgencyId", Number(e.target.value))}>
                  {agencies.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </Select>
              )}
            </Field>
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <Field label={t("startDate")} required error={err("startDate")}>
                {(f) => <Input {...f} type="date" min={todayISO()} value={v.startDate} onChange={(e) => { set("startDate", e.target.value); if (e.target.value >= v.endDate) set("endDate", e.target.value); }} />}
              </Field>
              <Field label={t("time")} optionalLabel={tc("optional")}>
                {(f) => <Input {...f} type="time" value={v.pickupTime} onChange={(e) => set("pickupTime", e.target.value)} />}
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <Field label={t("endDate")} required error={err("endDate")}>
                {(f) => <Input {...f} type="date" min={v.startDate} value={v.endDate} onChange={(e) => set("endDate", e.target.value)} />}
              </Field>
              <Field label={t("time")} optionalLabel={tc("optional")}>
                {(f) => <Input {...f} type="time" value={v.returnTime} onChange={(e) => set("returnTime", e.target.value)} />}
              </Field>
            </div>
          </div>
          {conflict && <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{tcars("unavailable")}</p>}
        </fieldset>

        {/* Chauffeur */}
        <fieldset className={section}>
          <legend className="text-lg font-bold text-ink">{t("needDriver")}</legend>
          <p className="mt-1 mb-4 text-sm text-ink-3">{driverPricePerDay > 0 ? t("driverPrice", { price: formatMoney(driverPricePerDay, locale) }) : t("driverOnQuote")}</p>
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
            {[false, true].map((yes) => (
              <label key={String(yes)} className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold", v.withDriver === yes ? "border-majorelle bg-majorelle-soft text-majorelle" : "border-mist text-ink-2 hover:border-mist-2")}>
                <input type="radio" name="driver" className="sr-only" checked={v.withDriver === yes} onChange={() => set("withDriver", yes)} />
                {yes ? tc("yes") : tc("no")}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Suppléments */}
        {extras.length > 0 && (
          <fieldset className={section}>
            <legend className="text-lg font-bold text-ink">{t("extrasTitle")}</legend>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {extras.map((x) => {
                const checked = v.extras.includes(x.id);
                return (
                  <label key={x.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${checked ? "border-majorelle bg-majorelle-soft" : "border-mist hover:border-mist-2"}`}>
                    <input type="checkbox" className="size-4 accent-[var(--majorelle)]" checked={checked} onChange={() => set("extras", checked ? v.extras.filter((i) => i !== x.id) : [...v.extras, x.id])} />
                    <span className="flex-1 text-sm font-medium text-ink">{x.name}</span>
                    <span className="text-end text-sm text-ink-3 tabular">
                      {formatMoney(x.price, locale)}
                      <span className="block text-[11px]">{x.pricing === "once" ? t("once") : tc("perDay")}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* Client connecté : informations à compléter */}
        {p && (
          <fieldset id="profile" className={cn(section, "scroll-mt-24")}>
            <legend className="text-lg font-bold text-ink">{t("yourInfo")}</legend>
            <p className="mt-1 mb-5 text-sm text-ink-3">{t("yourInfoHint")}</p>
            <ProfileFields value={p} onChange={setP} errors={errors} prefix="profile." withIds />
          </fieldset>
        )}

        <fieldset className={section}>
          <legend className="text-lg font-bold text-ink">{t("moreInfo")}</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t("flightNumber")} optionalLabel={tc("optional")}>
              {(f) => <Input {...f} dir="ltr" placeholder="AT 801" value={v.flightNumber} onChange={(e) => set("flightNumber", e.target.value)} />}
            </Field>
            <Field label={t("note")} optionalLabel={tc("optional")} className="sm:col-span-2">
              {(f) => <Textarea {...f} value={v.clientNote} onChange={(e) => set("clientNote", e.target.value)} />}
            </Field>
          </div>
        </fieldset>
      </div>

      {/* Récapitulatif */}
      <aside className="h-fit overflow-hidden rounded-[22px] border border-mist bg-paper lg:sticky lg:top-24">
        <div className="p-6">
          <h2 className="font-bold text-ink">{t("summary")}</h2>
          <p className="mt-1 text-sm text-ink-3">{car.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-3">
            <Clock className="size-3.5" />
            {formatDate(v.startDate, locale)}{v.pickupTime ? ` ${v.pickupTime}` : ""} → {formatDate(v.endDate, locale)}{v.returnTime ? ` ${v.returnTime}` : ""}
          </p>
          <dl className="mt-5 space-y-2.5 text-sm tabular">
            {carPromo && (
              <div className="flex justify-between text-saffron-ink">
                <dt>{t("carPromo", { percent: carPromo })}</dt>
                <dd className="font-semibold"><span className="me-1.5 font-normal text-ink-3 line-through">{formatMoney(car.dailyPrice, locale)}</span>{formatMoney(dayPrice, locale)} {tc("perDay")}</dd>
              </div>
            )}
            <div className="flex justify-between"><dt className="text-ink-2">{t("rental")} ({tc("days", { count: days })})</dt><dd className="font-semibold text-ink">{formatMoney(rental, locale)}</dd></div>
            {v.withDriver && <div className="flex justify-between"><dt className="text-ink-2">{t("driverLine")}</dt><dd className="font-semibold text-ink">{driverPricePerDay > 0 ? formatMoney(driverTotal, locale) : t("onQuote")}</dd></div>}
            {chosen.map((x) => (
              <div key={x.id} className="flex justify-between"><dt className="text-ink-2">{x.name}</dt><dd className="font-semibold text-ink">{formatMoney(extraCost(x, days), locale)}</dd></div>
            ))}
            {promo && <div className="flex justify-between text-palm"><dt>{t("discount")} <span dir="ltr">({promo.code})</span></dt><dd className="font-semibold">−{formatMoney(discount, locale)}</dd></div>}
            <div className="flex items-baseline justify-between border-t border-mist pt-3">
              <dt className="font-bold text-ink">{t("totalSum")}</dt>
              <dd className="text-2xl font-extrabold text-ink" style={{ fontStretch: "112%" }}>{formatMoney(total, locale)}</dd>
            </div>
            <div className="flex justify-between rounded-xl bg-chalk px-3 py-2.5">
              <dt className="flex items-center gap-1.5 font-semibold text-ink-2"><ShieldCheck className="size-4" />{t("depositLabel")}</dt>
              <dd className="font-bold text-ink">{formatMoney(car.deposit, locale)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-ink-3">{t("depositHint")}</p>

          <div className="mt-4">
            {promo ? (
              <p className="flex items-center gap-2 rounded-xl bg-palm-soft px-3 py-2 text-sm font-medium text-palm">
                <TicketPercent className="size-4 shrink-0" />
                <span className="flex-1" dir="ltr">{promo.label}</span>
                <button type="button" onClick={() => { setPromo(null); setPromoInput(""); }} aria-label={t("promoRemove")} className="rounded p-0.5 hover:bg-palm/10"><X className="size-4" /></button>
              </p>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-3" htmlFor="promo">{t("promoCode")}</label>
                <div className="flex gap-2">
                  <Input id="promo" dir="ltr" className="h-10 uppercase" value={promoInput} onChange={(e) => { setPromoInput(e.target.value); setPromoError(false); }} />
                  <Button type="button" variant="outline" className="h-10" loading={checkingPromo} disabled={!promoInput.trim()} onClick={() => applyPromo(promoInput)}>{t("promoApply")}</Button>
                </div>
                {promoError && <p className="mt-1.5 text-xs text-danger" role="alert">{t("promoInvalid")}</p>}
              </div>
            )}
          </div>

          <div id="terms-box" className={cn("mt-5 rounded-xl border p-3", errors.acceptTerms ? "border-danger bg-danger-soft/50" : "border-mist")}>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-2">
              <input type="checkbox" checked={v.acceptTerms} onChange={(e) => { set("acceptTerms", e.target.checked); setErrors((x) => ({ ...x, acceptTerms: "" })); }} className="mt-0.5 size-4 shrink-0 accent-[var(--majorelle)]" />
              <span>
                {t("acceptTerms")}{" "}
                <button type="button" onClick={() => setTermsOpen(true)} className="font-semibold text-majorelle underline-offset-2 hover:underline">{t("termsLink")}</button>
              </span>
            </label>
            {errors.acceptTerms && <p className="mt-1.5 text-xs font-medium text-danger" role="alert">{t("acceptTermsRequired")}</p>}
          </div>

          <Button type="button" size="lg" className="mt-4 w-full" loading={pending && !identify} disabled={conflict || days < 1} onClick={onReserve}>
            {t("reserve")}
          </Button>
          <p className="mt-3 text-center text-xs text-ink-3">{t("noPaymentNow")}</p>
        </div>
      </aside>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent title={t("termsTitle")} closeLabel={tc("close")} className="max-w-2xl">
          <div className="scroll-thin max-h-[65vh] overflow-y-auto pe-2 text-sm">{terms}</div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTermsOpen(false)}>{tc("close")}</Button>
            <Button onClick={() => { set("acceptTerms", true); setErrors((x) => ({ ...x, acceptTerms: "" })); setTermsOpen(false); }}>{t("acceptAndClose")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <IdentifyDialog
        open={identify}
        onOpenChange={setIdentify}
        pending={pending}
        errors={errors}
        socialEnabled={socialEnabled}
        callbackUrl={callbackUrl()}
        onLoggedIn={() => send()}
        onGuest={(g) => send(g)}
        ta={ta}
      />
    </div>
  );
}

/** Champs d'identité du client (civilité, nom, ville, téléphone, WhatsApp, et pièces pour un client connecté). */
function ProfileFields({ value, onChange, errors, prefix, withIds, hideWhatsapp = false }: { value: Profile; onChange: (p: Profile) => void; errors: Record<string, string>; prefix: string; withIds: boolean; hideWhatsapp?: boolean }) {
  const t = useTranslations("Booking");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const e = useTranslations("Enums");
  const set = (k: keyof Profile, x: string) => onChange({ ...value, [k]: x });
  const err = (k: string) => (errors[`${prefix}${k}`] ? te(errors[`${prefix}${k}`] as "required") : undefined);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("civility")} optionalLabel={tc("optional")}>
        {(f) => (
          <Select {...f} value={value.civility} onChange={(x) => set("civility", x.target.value)}>
            <option value="">—</option>
            <option value="male">{e("civility.male")}</option>
            <option value="female">{e("civility.female")}</option>
          </Select>
        )}
      </Field>
      <Field label={t("guestCity")} required error={err("city")}>
        {(f) => <CityCombobox {...f} value={value.city} onChange={(c) => set("city", c)} />}
      </Field>
      <Field label={t("guestLastName")} required error={err("lastName")}>
        {(f) => <Input {...f} autoComplete="family-name" value={value.lastName} onChange={(x) => set("lastName", x.target.value)} />}
      </Field>
      <Field label={t("guestFirstName")} required error={err("firstName")}>
        {(f) => <Input {...f} autoComplete="given-name" value={value.firstName} onChange={(x) => set("firstName", x.target.value)} />}
      </Field>
      <Field label={t("guestPhone")} required error={err("phone")}>
        {(f) => <PhoneInput {...f} value={value.phone} onChange={(x) => set("phone", x)} />}
      </Field>
      {!hideWhatsapp && (
        <Field label={t("guestWhatsapp")} optionalLabel={tc("optional")} error={err("whatsapp")}>
          {(f) => <PhoneInput {...f} value={value.whatsapp} onChange={(x) => set("whatsapp", x)} />}
        </Field>
      )}
      {withIds && (
        <>
          <Field label={t("idCardNumber")} required error={err("idCardNumber")}>
            {(f) => <Input {...f} dir="ltr" value={value.idCardNumber} onChange={(x) => set("idCardNumber", x.target.value)} />}
          </Field>
          <Field label={t("licenseNumber")} required error={err("licenseNumber")}>
            {(f) => <Input {...f} dir="ltr" value={value.licenseNumber} onChange={(x) => set("licenseNumber", x.target.value)} />}
          </Field>
        </>
      )}
    </div>
  );
}

/**
 * Identification au clic sur Réserver : réseaux sociaux (connexion ou inscription), email et mot de passe,
 * ou nouvelle fiche (civilité, nom, prénom, ville, téléphone — WhatsApp ou non — et email facultatif).
 */
function IdentifyDialog({
  open,
  onOpenChange,
  pending,
  errors,
  socialEnabled,
  callbackUrl,
  onLoggedIn,
  onGuest,
  ta,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pending: boolean;
  errors: Record<string, string>;
  socialEnabled: Record<string, boolean>;
  callbackUrl: string;
  onLoggedIn: () => void;
  onGuest: (g: Record<string, unknown>) => void;
  ta: ReturnType<typeof useTranslations>;
}) {
  const t = useTranslations("Booking");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const [tab, setTab] = useState<"new" | "login">("new");
  const [g, setG] = useState<Profile & { email: string; whatsappSame: boolean }>({ civility: "", firstName: "", lastName: "", city: "", phone: "", whatsapp: "", idCardNumber: "", licenseNumber: "", email: "", whatsappSame: true });
  const [login, setLogin] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [logging, startLogin] = useTransition();
  const gerr = (k: string) => (errors[`guest.${k}`] ? te(errors[`guest.${k}`] as "required") : undefined);
  const guestErrors = Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith("guest.")));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("identifyTitle")} description={t("identifyBody")} closeLabel={tc("close")} className="max-w-2xl">
        <div className="scroll-thin max-h-[70vh] space-y-5 overflow-y-auto pe-1">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">{t("withSocial")}</p>
            <SocialButtons enabled={socialEnabled} callbackUrl={callbackUrl} />
            <p className="mt-2 text-xs text-ink-3">{t("socialHint")}</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-ink-3">
            <span className="h-px flex-1 bg-mist-2" />
            {t("or")}
            <span className="h-px flex-1 bg-mist-2" />
          </div>
          <div role="tablist" className="inline-flex rounded-xl bg-mist/60 p-1 text-sm font-semibold">
            {(["new", "login"] as const).map((x) => (
              <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5", tab === x ? "bg-paper text-ink shadow-sm" : "text-ink-3 hover:text-ink")}>
                {x === "new" ? <UserPlus className="size-4" /> : <KeyRound className="size-4" />}
                {x === "new" ? t("tabNewClient") : t("tabHaveAccount")}
              </button>
            ))}
          </div>
          {tab === "login" ? (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                setLoginError("");
                startLogin(async () => {
                  const r = await bookingLoginAction(login.email, login.password, await getRecaptchaToken("login"));
                  if (!r.ok) return setLoginError(["invalid", "disabled", "staff", "locked", "captcha", "server"].includes(r.error) ? ta(`errors.${r.error}` as "errors.invalid") : r.error === "totp_required" ? t("useLoginPage") : te("unknown"));
                  onLoggedIn();
                });
              }}
            >
              <Field label={ta("email")} required>{(f) => <Input {...f} type="email" dir="ltr" autoComplete="email" value={login.email} onChange={(x) => setLogin((s) => ({ ...s, email: x.target.value }))} />}</Field>
              <Field label={ta("password")} required>{(f) => <Input {...f} type="password" autoComplete="current-password" value={login.password} onChange={(x) => setLogin((s) => ({ ...s, password: x.target.value }))} />}</Field>
              {loginError && <p className="text-sm font-medium text-danger sm:col-span-2" role="alert">{loginError}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                <Link href="/forgot-password" className="text-sm font-medium text-majorelle hover:underline">{ta("forgot")}</Link>
                <Button type="submit" loading={logging || pending}>{t("loginAndReserve")}</Button>
              </div>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                onGuest({ civility: g.civility, firstName: g.firstName, lastName: g.lastName, city: g.city, phone: g.phone, whatsapp: g.whatsappSame ? g.phone : g.whatsapp, email: g.email });
              }}
            >
              <ProfileFields
                value={g}
                onChange={(x) => setG((s) => ({ ...s, ...x }))}
                errors={guestErrors}
                prefix="guest."
                withIds={false}
                hideWhatsapp={g.whatsappSame}
              />
              <Checkbox checked={g.whatsappSame} onChange={(x) => setG((s) => ({ ...s, whatsappSame: x.target.checked }))} label={t("phoneIsWhatsapp")} />
              <Field label={t("guestEmail")} optionalLabel={tc("optional")} error={gerr("email")} hint={t("guestEmailHint")}>
                {(f) => <Input {...f} type="email" dir="ltr" autoComplete="email" value={g.email} onChange={(x) => setG((s) => ({ ...s, email: x.target.value }))} />}
              </Field>
              <div className="flex justify-end">
                <Button type="submit" size="lg" loading={pending}>{t("reserve")}</Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
