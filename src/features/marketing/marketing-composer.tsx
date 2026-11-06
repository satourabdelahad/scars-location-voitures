"use client";

import { Building2, Eye, Mail, Search, Send, TicketPercent, UsersRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge, Panel } from "@/components/ui/misc";
import { MultiSelect } from "@/components/ui/multi-select";
import { useRouter } from "@/i18n/navigation";
import { cn, formatDate, todayISO } from "@/lib/utils";
import { previewMarketingEmail, sendCampaign } from "@/server/actions/marketing";
import type { AudienceRow } from "@/server/queries/marketing";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Email Marketing : filtrer les clients (ville, nombre de jours loués, recherche), puis leur envoyer
 * un code de réduction. Le code est attribué au client quand il clique sur le bouton de l'email.
 */
export function MarketingComposer({ audience }: { audience: AudienceRow[] }) {
  const t = useTranslations("Marketing");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const tm = useTranslations("Managers");
  const locale = useLocale();
  const router = useRouter();
  const [cities, setCities] = useState<string[]>([]);
  const [minDays, setMinDays] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [q, setQ] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [v, setV] = useState({ name: "", message: "", percent: "10", endsOn: todayISO(30), minDays: "1" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const cityOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of audience) {
      const c = r.city?.trim() || t("noCity");
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr")).map(([value, count]) => ({ value, label: value, count }));
  }, [audience, t]);

  const filtered = useMemo(() => {
    const n = norm(q.trim());
    const lo = minDays === "" ? null : Number(minDays);
    const hi = maxDays === "" ? null : Number(maxDays);
    return audience.filter(
      (r) =>
        (!cities.length || cities.includes(r.city?.trim() || t("noCity"))) &&
        (lo === null || r.days >= lo) &&
        (hi === null || r.days <= hi) &&
        (!n || norm(`${r.name} ${r.email} ${r.city ?? ""}`).includes(n)),
    );
  }, [audience, cities, minDays, maxDays, q, t]);
  const recipients = filtered.filter((r) => !excluded.has(r.id));
  const set = <K extends keyof typeof v>(k: K, value: string) => setV((x) => ({ ...x, [k]: value }));
  const err = (k: string) => (errors[k] ? te(errors[k] as "required") : undefined);

  const check = () => {
    const fe: Record<string, string> = {};
    if (v.name.trim().length < 3) fe.name = "required";
    const p = Number(v.percent);
    if (!Number.isInteger(p) || p < 1 || p > 90) fe.percent = "numberRange";
    if (!v.endsOn || v.endsOn < todayISO()) fe.endsOn = "futureDate";
    const d = Number(v.minDays);
    if (!Number.isInteger(d) || d < 1 || d > 60) fe.minDays = "numberRange";
    if (!recipients.length) fe.clientIds = "required";
    setErrors(fe);
    if (fe.clientIds) toast.error(t("noRecipients"));
    return Object.keys(fe).length === 0;
  };

  const showPreview = () =>
    start(async () => {
      const r = await previewMarketingEmail({ name: v.name, message: v.message, percent: Number(v.percent), endsOn: v.endsOn, minDays: Number(v.minDays) });
      if (r.ok) setPreview(r.data!);
      else toast.error(te(r.error as "unknown"));
    });

  const send = () =>
    start(async () => {
      const r = await sendCampaign({
        name: v.name,
        message: v.message,
        percent: Number(v.percent),
        endsOn: v.endsOn,
        minDays: Number(v.minDays),
        clientIds: recipients.map((x) => x.id),
        filters: { cities, minDays: minDays === "" ? null : Number(minDays), maxDays: maxDays === "" ? null : Number(maxDays), search: q || undefined },
      });
      setConfirm(false);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        return void toast.error(te(r.error as "unknown"));
      }
      const d = r.data!;
      if (d.sent) toast.success(t("sent", { count: d.sent, code: d.code }));
      if (d.skipped) toast.warning(t("skipped", { count: d.skipped }));
      if (d.failed) toast.error(t("failed", { count: d.failed }));
      setV({ name: "", message: "", percent: "10", endsOn: todayISO(30), minDays: "1" });
      router.refresh();
    });

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Panel className="p-5">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          <UsersRound className="size-4 text-majorelle" />
          {t("audienceTitle")}
        </h2>
        <p className="mt-0.5 text-sm text-ink-3">{t("audienceHint")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <MultiSelect
              label={t("cities")}
              icon={<Building2 />}
              options={cityOptions}
              value={cities}
              onChange={setCities}
              searchPlaceholder={tm("searchCity")}
              allLabel={tm("allCities")}
              clearLabel={tm("clearChoice")}
              emptyLabel={tm("noOption")}
            />
          </div>
          <Field label={t("minDays")}>
            {(p) => <Input {...p} type="number" min={0} inputMode="numeric" placeholder="0" value={minDays} onChange={(e) => setMinDays(e.target.value)} />}
          </Field>
          <Field label={t("maxDays")}>
            {(p) => <Input {...p} type="number" min={0} inputMode="numeric" placeholder="∞" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} />}
          </Field>
        </div>
        <label className="mt-3 flex h-10 items-center gap-2 rounded-[10px] border border-mist-2 bg-paper px-3 focus-within:border-majorelle">
          <Search className="size-4 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink" aria-live="polite">
            {t("recipientsCount", { count: recipients.length, total: audience.length })}
          </p>
          {excluded.size > 0 && (
            <button type="button" onClick={() => setExcluded(new Set())} className="text-xs font-semibold text-majorelle hover:underline">
              {t("includeAll")}
            </button>
          )}
        </div>
        <ul className={cn("scroll-thin mt-2 max-h-[420px] divide-y divide-mist overflow-y-auto rounded-xl border", errors.clientIds ? "border-danger" : "border-mist")}>
          {filtered.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-3">{t("noMatch")}</li>}
          {filtered.map((r) => {
            const on = !excluded.has(r.id);
            return (
              <li key={r.id}>
                <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-chalk", !on && "opacity-55")}>
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--majorelle)]"
                    checked={on}
                    onChange={() => setExcluded((s) => { const n = new Set(s); if (on) n.add(r.id); else n.delete(r.id); return n; })}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                    <span className="block truncate text-xs text-ink-3" dir="ltr">{r.email}</span>
                  </span>
                  <span className="hidden text-xs text-ink-3 sm:block">{r.city ?? "—"}</span>
                  <Badge tone={r.days ? "info" : "neutral"}>{t("daysRented", { count: r.days })}</Badge>
                </label>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel className="p-5 xl:sticky xl:top-24">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          <TicketPercent className="size-4 text-majorelle" />
          {t("composeTitle")}
        </h2>
        <p className="mt-0.5 text-sm text-ink-3">{t("composeHint")}</p>
        <div className="mt-4 grid gap-4">
          <Field label={t("campaignName")} required error={err("name")} hint={t("campaignNameHint")}>
            {(p) => <Input {...p} value={v.name} maxLength={160} onChange={(e) => set("name", e.target.value)} placeholder={t("campaignNamePlaceholder")} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("percent")} required error={err("percent")}>
              {(p) => <Input {...p} type="number" min={1} max={90} inputMode="numeric" value={v.percent} onChange={(e) => set("percent", e.target.value)} />}
            </Field>
            <Field label={t("endsOn")} required error={err("endsOn")}>
              {(p) => <Input {...p} type="date" min={todayISO()} value={v.endsOn} onChange={(e) => set("endsOn", e.target.value)} />}
            </Field>
            <Field label={t("minRental")} required error={err("minDays")}>
              {(p) => <Input {...p} type="number" min={1} max={60} inputMode="numeric" value={v.minDays} onChange={(e) => set("minDays", e.target.value)} />}
            </Field>
          </div>
          <Field label={t("message")} optionalLabel={tc("optional")} hint={t("messageHint")}>
            {(p) => <Textarea {...p} rows={4} maxLength={2000} value={v.message} onChange={(e) => set("message", e.target.value)} />}
          </Field>
          <p className="rounded-xl bg-majorelle-soft px-4 py-3 text-sm text-majorelle">{t("howItWorks")}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={showPreview} disabled={pending}>
              <Eye />
              {t("preview")}
            </Button>
            <Button onClick={() => check() && setConfirm(true)} disabled={pending}>
              <Send />
              {t("send", { count: recipients.length })}
            </Button>
          </div>
        </div>
      </Panel>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent title={preview?.subject ?? ""} description={t("previewHint")} closeLabel={tc("close")} className="max-w-2xl">
          {preview && <iframe title={t("preview")} srcDoc={preview.html} sandbox="" className="h-[60vh] w-full rounded-xl border border-mist bg-white" />}
        </DialogContent>
      </Dialog>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title={t("confirmTitle", { count: recipients.length })} closeLabel={tc("close")}>
          <p className="text-sm text-ink-2">
            {t("confirmBody", { percent: v.percent, date: v.endsOn ? formatDate(v.endsOn, locale) : "—", days: v.minDays })}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>{tc("cancel")}</Button>
            <Button onClick={send} loading={pending}>
              <Mail />
              {tc("confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
