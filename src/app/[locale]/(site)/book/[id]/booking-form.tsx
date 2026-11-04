"use client";

import { CheckCircle2, TicketPercent, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CarArt } from "@/components/car-art";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { Link } from "@/i18n/navigation";
import type { CarCategory } from "@/db/schema";
import { formatDate, formatMoney, rentalDays, todayISO } from "@/lib/utils";
import { checkPromoCode, createReservation } from "@/server/actions/reservations";
import { getRecaptchaToken, RecaptchaScript } from "@/components/recaptcha/recaptcha";

type Props = {
  car: { id: string; name: string; category: CarCategory; colorHex: string; dailyPrice: number; deposit: number; agencyId: number; cover: string | null };
  agencies: { id: number; label: string }[];
  extras: { id: number; code: string; pricePerDay: number }[];
  booked: { start: string; end: string }[];
  defaults: { startDate: string; endDate: string; driverFirstName: string; driverLastName: string };
  locale: string;
};

export function BookingForm({ car, agencies, extras, booked, defaults, locale }: Props) {
  const t = useTranslations("Booking");
  const tx = useTranslations("Extras");
  const te = useTranslations("Errors");
  const tc = useTranslations("Common");
  const tcars = useTranslations("Cars");
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const [v, setV] = useState({
    startDate: defaults.startDate,
    endDate: defaults.endDate,
    pickupAgencyId: car.agencyId,
    returnAgencyId: car.agencyId,
    extras: [] as number[],
    driverFirstName: defaults.driverFirstName,
    driverLastName: defaults.driverLastName,
    driverPhone: "",
    driverLicenseNumber: "",
    driverBirthDate: "",
    flightNumber: "",
    clientNote: "",
  });

  const days = Math.max(0, rentalDays(v.startDate, v.endDate));
  const extrasTotal = extras.filter((x) => v.extras.includes(x.id)).reduce((s, x) => s + x.pricePerDay * days, 0);
  const rental = car.dailyPrice * days;
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; label: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState(false);
  const [checkingPromo, startPromo] = useTransition();
  const discount = promo?.discount ?? 0;

  function applyPromo(code: string, vals: Pick<typeof v, "startDate" | "endDate" | "extras"> = v) {
    setPromoError(false);
    startPromo(async () => {
      const r = await checkPromoCode({ code, carId: car.id, startDate: vals.startDate, endDate: vals.endDate, extras: vals.extras });
      if (r.ok) setPromo({ code: r.code, label: r.label, discount: r.discount });
      else {
        setPromo(null);
        setPromoError(true);
      }
    });
  }
  // Dates ou options modifiées : la remise est recalculée (ou retirée si le code ne s'applique plus).
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => {
    const next = { ...v, [k]: value };
    setV(next);
    if (promo && (k === "startDate" || k === "endDate" || k === "extras")) applyPromo(promo.code, next);
  };
  const conflict = useMemo(() => booked.some((b) => b.start < v.endDate && b.end > v.startDate), [booked, v.startDate, v.endDate]);

  function err(k: string) {
    const code = errors[k];
    if (!code) return undefined;
    return code === "minAge21" ? t("minAge") : te(code as "required");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    start(async () => {
      const res = await createReservation({ ...v, carId: car.id, promoCode: promo?.code }, await getRecaptchaToken("booking"));
      if (res.ok) {
        setDone(res.data!.reference);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(te(res.error as "unknown"));
      }
    });
  }

  if (done) {
    return (
      <div className="mt-8 flex flex-col items-center rounded-[26px] border border-mist bg-paper px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-palm-soft text-palm"><CheckCircle2 className="size-8" /></span>
        <h2 className="display-md mt-5 text-3xl text-ink">{t("successTitle")}</h2>
        <p className="mt-3 max-w-md text-ink-2">{t("successBody", { ref: done })}</p>
        <Button asChild className="mt-8" size="lg"><Link href="/account">{t("goToReservations")}</Link></Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]" noValidate>
      <RecaptchaScript />
      <div className="space-y-8">
        <fieldset className="rounded-[22px] border border-mist bg-paper p-6">
          <legend className="sr-only">{t("stepDates")}</legend>
          <h2 className="mb-5 text-lg font-bold text-ink">{t("stepDates")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("startDate")} required error={err("startDate")}>
              {(p) => <Input {...p} type="date" min={todayISO()} value={v.startDate} onChange={(e) => { set("startDate", e.target.value); if (e.target.value >= v.endDate) set("endDate", e.target.value); }} />}
            </Field>
            <Field label={t("endDate")} required error={err("endDate")}>
              {(p) => <Input {...p} type="date" min={v.startDate} value={v.endDate} onChange={(e) => set("endDate", e.target.value)} />}
            </Field>
            <Field label={t("pickupAgency")} required>
              {(p) => (
                <Select {...p} value={v.pickupAgencyId} onChange={(e) => set("pickupAgencyId", Number(e.target.value))}>
                  {agencies.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label={t("returnAgency")} required>
              {(p) => (
                <Select {...p} value={v.returnAgencyId} onChange={(e) => set("returnAgencyId", Number(e.target.value))}>
                  {agencies.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </Select>
              )}
            </Field>
          </div>
          {conflict && <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{tcars("unavailable")}</p>}
        </fieldset>

        <fieldset className="rounded-[22px] border border-mist bg-paper p-6">
          <legend className="sr-only">{t("options")}</legend>
          <h2 className="mb-5 text-lg font-bold text-ink">{t("options")}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {extras.map((x) => {
              const checked = v.extras.includes(x.id);
              return (
                <label key={x.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${checked ? "border-majorelle bg-majorelle-soft" : "border-mist hover:border-mist-2"}`}>
                  <input type="checkbox" className="size-4 accent-[var(--majorelle)]" checked={checked} onChange={() => set("extras", checked ? v.extras.filter((i) => i !== x.id) : [...v.extras, x.id])} />
                  <span className="flex-1 text-sm font-medium text-ink">{tx(x.code as "gps")}</span>
                  <span className="text-sm text-ink-3 tabular">{formatMoney(x.pricePerDay, locale)} {tc("perDay")}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="rounded-[22px] border border-mist bg-paper p-6">
          <legend className="sr-only">{t("stepDriver")}</legend>
          <h2 className="mb-5 text-lg font-bold text-ink">{t("stepDriver")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("driverFirstName")} required error={err("driverFirstName")}>
              {(p) => <Input {...p} autoComplete="given-name" value={v.driverFirstName} onChange={(e) => set("driverFirstName", e.target.value)} />}
            </Field>
            <Field label={t("driverLastName")} required error={err("driverLastName")}>
              {(p) => <Input {...p} autoComplete="family-name" value={v.driverLastName} onChange={(e) => set("driverLastName", e.target.value)} />}
            </Field>
            <Field label={t("driverPhone")} required error={err("driverPhone")}>
              {(p) => <PhoneInput {...p} value={v.driverPhone} onChange={(x) => set("driverPhone", x)} />}
            </Field>
            <Field label={t("driverBirthDate")} required error={err("driverBirthDate")}>
              {(p) => <Input {...p} type="date" autoComplete="bday" value={v.driverBirthDate} onChange={(e) => set("driverBirthDate", e.target.value)} />}
            </Field>
            <Field label={t("driverLicense")} required error={err("driverLicenseNumber")}>
              {(p) => <Input {...p} dir="ltr" value={v.driverLicenseNumber} onChange={(e) => set("driverLicenseNumber", e.target.value)} />}
            </Field>
            <Field label={t("flightNumber")} optionalLabel={tc("optional")}>
              {(p) => <Input {...p} dir="ltr" placeholder="AT 801" value={v.flightNumber} onChange={(e) => set("flightNumber", e.target.value)} />}
            </Field>
            <Field label={t("note")} optionalLabel={tc("optional")} className="sm:col-span-2">
              {(p) => <Textarea {...p} value={v.clientNote} onChange={(e) => set("clientNote", e.target.value)} />}
            </Field>
          </div>
        </fieldset>
      </div>

      <aside className="h-fit overflow-hidden rounded-[22px] border border-mist bg-paper lg:sticky lg:top-24">
        <div className="bg-gradient-to-b from-chalk to-mist/60 px-6 pt-6">
          <CarArt category={car.category} color={car.colorHex} className="w-full" />
        </div>
        <div className="p-6">
          <h2 className="font-bold text-ink">{t("summary")}</h2>
          <p className="mt-1 text-sm text-ink-3">{car.name}</p>
          <p className="mt-1 text-sm text-ink-3">{formatDate(v.startDate, locale)} – {formatDate(v.endDate, locale)}</p>
          <dl className="mt-5 space-y-2.5 text-sm tabular">
            <div className="flex justify-between"><dt className="text-ink-2">{t("rental")} ({tc("days", { count: days })})</dt><dd className="font-semibold text-ink">{formatMoney(rental, locale)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-2">{t("extrasTotal")}</dt><dd className="font-semibold text-ink">{formatMoney(extrasTotal, locale)}</dd></div>
            {promo && (
              <div className="flex justify-between text-palm"><dt>{t("discount")} <span dir="ltr">({promo.code})</span></dt><dd className="font-semibold">−{formatMoney(discount, locale)}</dd></div>
            )}
            <div className="flex items-baseline justify-between border-t border-mist pt-3">
              <dt className="font-bold text-ink">{t("total")}</dt>
              <dd className="text-2xl font-extrabold text-ink" style={{ fontStretch: "112%" }}>{formatMoney(rental + extrasTotal - discount, locale)}</dd>
            </div>
          </dl>
          <div className="mt-4">
            {promo ? (
              <p className="flex items-center gap-2 rounded-xl bg-palm-soft px-3 py-2 text-sm font-medium text-palm">
                <TicketPercent className="size-4 shrink-0" />
                <span className="flex-1" dir="ltr">{promo.label}</span>
                <button type="button" onClick={() => { setPromo(null); setPromoInput(""); }} aria-label={t("promoRemove")} title={t("promoRemove")} className="rounded p-0.5 hover:bg-palm/10">
                  <X className="size-4" />
                </button>
              </p>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-3" htmlFor="promo">{t("promoCode")}</label>
                <div className="flex gap-2">
                  <Input id="promo" dir="ltr" className="h-10 uppercase" value={promoInput} onChange={(e) => { setPromoInput(e.target.value); setPromoError(false); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (promoInput.trim()) applyPromo(promoInput); } }} aria-invalid={promoError || undefined} />
                  <Button type="button" variant="outline" className="h-10" loading={checkingPromo} disabled={!promoInput.trim()} onClick={() => applyPromo(promoInput)}>{t("promoApply")}</Button>
                </div>
                {promoError && <p className="mt-1.5 text-xs text-danger" role="alert">{t("promoInvalid")}</p>}
              </div>
            )}
          </div>
          <p className="mt-4 rounded-xl bg-saffron/15 px-3.5 py-3 text-xs leading-relaxed text-saffron-ink">{t("payOnPickup", { deposit: formatMoney(car.deposit, locale) })}</p>
          <Button type="submit" size="lg" className="mt-5 w-full" loading={pending} disabled={conflict || days < 1}>
            {pending ? t("sending") : t("submit")}
          </Button>
        </div>
      </aside>
    </form>
  );
}
