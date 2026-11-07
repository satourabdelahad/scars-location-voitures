"use client";

/* eslint-disable @next/next/no-img-element */
import { Copy, Download, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/utils";
import { confirmTwoFactor, disableTwoFactor, regenerateRecoveryCodes, startTwoFactorSetup } from "@/server/actions/two-factor";

type Step = "idle" | "scan" | "codes" | "manage";

export function TwoFactorPanel({ enabledAt, codesLeft, locale }: { enabledAt: string | null; codesLeft: number; locale: string }) {
  const t = useTranslations("Security");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [step, setStep] = useState<Step>(enabledAt ? "manage" : "idle");
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [pending, start] = useTransition();

  const fail = (error: string) => {
    if (error === "totp_invalid") setCodeError(t("codeInvalid"));
    else toast.error(te(error as "unknown"));
  };

  function begin() {
    start(async () => {
      const r = await startTwoFactorSetup();
      if (!r.ok) return fail(r.error);
      setSetup(r.data!);
      setCode("");
      setStep("scan");
    });
  }

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    setCodeError(null);
    start(async () => {
      const r = await confirmTwoFactor(code);
      if (!r.ok) return fail(r.error);
      setRecovery(r.data!.recoveryCodes);
      setStep("codes");
      toast.success(t("enabled"));
    });
  }

  function regenerate(e: React.FormEvent) {
    e.preventDefault();
    setCodeError(null);
    start(async () => {
      const r = await regenerateRecoveryCodes(code);
      if (!r.ok) return fail(r.error);
      setRecovery(r.data!.recoveryCodes);
      setCode("");
      setStep("codes");
    });
  }

  function disable() {
    setCodeError(null);
    start(async () => {
      const r = await disableTwoFactor(code);
      if (!r.ok) return fail(r.error);
      toast.success(t("disabled"));
      setCode("");
      setStep("idle");
      router.refresh();
    });
  }

  const codeField = (
    <Field label={t("code")} required error={codeError ?? undefined}>
      {(p) => (
        <Input
          {...p}
          value={code}
          onChange={(x) => setCode(x.target.value)}
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={9}
          placeholder="123456"
          className="max-w-48 text-center font-mono text-lg tracking-[0.3em]"
        />
      )}
    </Field>
  );

  return (
    <section className="rounded-2xl border border-mist bg-paper p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-majorelle-soft text-majorelle"><ShieldCheck className="size-5" /></span>
          <div>
            <h2 className="font-bold text-ink">{t("twoFactor")}</h2>
            <p className="mt-0.5 max-w-prose text-sm text-ink-3">{t("twoFactorHint")}</p>
          </div>
        </div>
        {step === "manage" || step === "codes" ? <Badge tone="success" dot>{t("on")}</Badge> : <Badge tone="warning" dot>{t("off")}</Badge>}
      </div>

      <div className="mt-6 border-t border-mist pt-6">
        {step === "idle" && (
          <Button onClick={begin} loading={pending}>
            <ShieldCheck />
            {t("enable")}
          </Button>
        )}

        {step === "scan" && setup && (
          <form onSubmit={confirm} className="grid gap-6 md:grid-cols-[auto_1fr]">
            <img src={setup.qr} alt={t("qrAlt")} width={200} height={200} className="rounded-xl border border-mist" />
            <div className="space-y-4">
              <ol className="list-decimal space-y-1.5 ps-5 text-sm text-ink-2">
                <li>{t("scan1")}</li>
                <li>{t("scan2")}</li>
                <li>{t("scan3")}</li>
              </ol>
              <div>
                <p className="text-xs font-medium text-ink-3">{t("manualKey")}</p>
                <button
                  type="button"
                  dir="ltr"
                  onClick={() => navigator.clipboard?.writeText(setup.secret).then(() => toast.success(t("copied")))}
                  className="mt-1 inline-flex items-center gap-2 rounded-lg bg-chalk px-3 py-1.5 font-mono text-sm break-all text-ink hover:bg-mist"
                >
                  {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
                  <Copy className="size-3.5 shrink-0 text-ink-3" />
                </button>
              </div>
              {codeField}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setStep("idle")}>{t("cancel")}</Button>
                <Button type="submit" loading={pending} disabled={code.trim().length < 6}>{t("confirm")}</Button>
              </div>
            </div>
          </form>
        )}

        {step === "codes" && recovery && (
          <div className="space-y-4">
            <div className="rounded-xl border border-saffron/40 bg-saffron/10 px-4 py-3 text-sm text-ink">
              <p className="font-semibold">{t("recoveryTitle")}</p>
              <p className="mt-0.5 text-ink-2">{t("recoveryHint")}</p>
            </div>
            <ul dir="ltr" className="grid max-w-md grid-cols-2 gap-2 font-mono text-[15px]">
              {recovery.map((c) => (
                <li key={c} className="rounded-lg bg-chalk px-3 py-2 text-center text-ink">{c}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigator.clipboard?.writeText(recovery.join("\n")).then(() => toast.success(t("copied")))}>
                <Copy />
                {t("copy")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const blob = new Blob([`Dizy Cars — ${t("recoveryTitle")}\n\n${recovery.join("\n")}\n`], { type: "text/plain" });
                  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "dizy-cars-codes-de-secours.txt" });
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
              >
                <Download />
                {t("download")}
              </Button>
              <Button
                onClick={() => {
                  setRecovery(null);
                  setStep("manage");
                  router.refresh();
                }}
              >
                {t("done")}
              </Button>
            </div>
          </div>
        )}

        {step === "manage" && (
          <div className="space-y-5">
            <p className="text-sm text-ink-2">
              {enabledAt ? t("enabledSince", { date: formatDateTime(enabledAt, locale) }) : t("on")} · {t("codesLeft", { count: codesLeft })}
            </p>
            <form onSubmit={regenerate} className="space-y-3">
              <p className="text-sm text-ink-3">{t("manageHint")}</p>
              {codeField}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="outline" loading={pending} disabled={code.trim().length < 6}>
                  <KeyRound />
                  {t("regenerate")}
                </Button>
                <Button type="button" variant="dangerOutline" loading={pending} disabled={code.trim().length < 6} onClick={disable}>
                  <ShieldOff />
                  {t("disable")}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
