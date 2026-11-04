"use client";

import { CalendarPlus, Car, Check, Clock, MapPin, Phone, UserX, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, EmptyState, Panel, type Tone } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { intlLocale } from "@/i18n/config";
import { appointmentKindEnum, type AppointmentStatus } from "@/db/schema";
import { cn } from "@/lib/utils";
import { createAppointment, setAppointmentStatus } from "@/server/actions/appointments";
import type { ScheduledRow } from "@/server/queries/manager-profile";
import type { ClientOption } from "@/server/queries/clients";
import { ClientPicker } from "@/features/clients/client-picker";

const STATUS_TONE: Record<AppointmentStatus, Tone> = { planned: "info", done: "success", cancelled: "neutral", no_show: "danger" };
type Options = { agencies: { id: number; city: string; name: string }[]; cars: { id: string; label: string }[]; staff: { id: string; name: string; role: string }[] };

/** Rendez-vous planifiés : bouton « Nouveau rendez-vous » et liste par jour. */
export function ScheduledAppointments({ rows, options, base, isAdmin, meId }: { rows: ScheduledRow[]; options: Options; base: string; isAdmin: boolean; meId: string }) {
  const t = useTranslations("Appointments");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const te = useTranslations("Errors");
  const dayFmt = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Casablanca" });
  const timeFmt = new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" });
  const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date(iso));
  const groups: { key: string; label: string; items: ScheduledRow[] }[] = [];
  for (const r of rows) {
    const k = dayKey(r.startsAt);
    let g = groups[groups.length - 1];
    if (!g || g.key !== k) groups.push((g = { key: k, label: dayFmt.format(new Date(r.startsAt)), items: [] }));
    g.items.push(r);
  }

  const mark = (id: string, status: AppointmentStatus) =>
    start(async () => {
      const r = await setAppointmentStatus(id, status);
      if (r.ok) router.refresh();
      else toast.error(te(r.error as "unknown"));
    });

  return (
    <Panel className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-ink">{t("title")}</h2>
          <p className="text-sm text-ink-3">{t("hint")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <CalendarPlus />
          {t("new")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<CalendarPlus />} title={t("emptyTitle")} body={t("empty")} />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="mb-2 text-xs font-bold tracking-wide text-ink-3 uppercase">{g.label}</h3>
              <ul className="space-y-2">
                {g.items.map((a) => (
                  <li key={a.id} className={cn("flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3", a.status === "planned" ? "border-mist bg-paper" : "border-mist bg-chalk/60")}>
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg bg-majorelle-soft px-2 py-1 text-sm font-bold text-majorelle tabular">
                      <Clock className="size-3.5" />
                      {timeFmt.format(new Date(a.startsAt))}
                    </span>
                    <div className="min-w-[12rem] flex-1">
                      <p className={cn("text-sm font-semibold text-ink", a.status === "cancelled" && "line-through opacity-60")}>
                        {t(`kind.${a.kind}`)} ·{" "}
                        <Link href={`${base}/clients/${a.clientId}`} className="hover:text-majorelle">{a.client}</Link>
                        <span className="font-normal text-ink-3"> · {t("minutes", { count: a.durationMin })}</span>
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
                        {a.phone && <a href={`tel:${a.phone}`} dir="ltr" className="inline-flex items-center gap-1 hover:text-majorelle"><Phone className="size-3.5" />{a.phone}</a>}
                        {a.agency && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{a.agency}</span>}
                        {a.car && <span className="inline-flex items-center gap-1"><Car className="size-3.5" />{a.car}</span>}
                        {isAdmin && a.assignee && <span>{t("with", { name: a.assignee })}</span>}
                      </p>
                      {a.notes && <p className="mt-1.5 text-sm whitespace-pre-line text-ink-2">{a.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge tone={STATUS_TONE[a.status]}>{t(`status.${a.status}`)}</Badge>
                      {a.status === "planned" && (
                        <>
                          <button type="button" disabled={pending} onClick={() => mark(a.id, "done")} title={t("markDone")} aria-label={t("markDone")} className="grid size-8 place-items-center rounded-lg text-palm hover:bg-palm-soft"><Check className="size-4" /></button>
                          <button type="button" disabled={pending} onClick={() => mark(a.id, "no_show")} title={t("markNoShow")} aria-label={t("markNoShow")} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"><UserX className="size-4" /></button>
                          <button type="button" disabled={pending} onClick={() => mark(a.id, "cancelled")} title={t("markCancelled")} aria-label={t("markCancelled")} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-mist hover:text-ink"><X className="size-4" /></button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {open && <NewAppointmentDialog options={options} isAdmin={isAdmin} meId={meId} onClose={() => setOpen(false)} />}
    </Panel>
  );
}

function NewAppointmentDialog({ options, isAdmin, meId, onClose }: { options: Options; isAdmin: boolean; meId: string; onClose: () => void }) {
  const t = useTranslations("Appointments");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const router = useRouter();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());
  const [client, setClient] = useState<ClientOption | null>(null);
  const [v, setV] = useState({ kind: "meeting", date: today, time: "10:00", durationMin: 30, agencyId: "", carId: "", assignedTo: meId, notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }));
  const err = (k: string) => (errors[k] ? te(errors[k] as "required") : undefined);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (!client) return setErrors({ clientId: "required" });
    start(async () => {
      const r = await createAppointment({ ...v, clientId: client.id });
      if (r.ok) {
        toast.success(t("created"));
        router.refresh();
        onClose();
      } else {
        if (r.fieldErrors) setErrors(r.fieldErrors);
        toast.error(te(r.error as "unknown"));
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("new")} closeLabel={tc("close")} className="max-h-[calc(100dvh-32px)] max-w-2xl overflow-y-auto">
        <form onSubmit={save} noValidate className="space-y-4">
          <Field label={t("client")} required error={err("clientId")}>
            {(p) => <ClientPicker id={p.id} value={client} onChange={setClient} invalid={Boolean(errors.clientId)} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("type")} required>
              {(p) => (
                <Select {...p} value={v.kind} onChange={(x) => set("kind", x.target.value)}>
                  {appointmentKindEnum.enumValues.map((k) => <option key={k} value={k}>{t(`kind.${k}`)}</option>)}
                </Select>
              )}
            </Field>
            <Field label={t("duration")} required error={err("durationMin")}>
              {(p) => (
                <Select {...p} value={v.durationMin} onChange={(x) => set("durationMin", Number(x.target.value))}>
                  {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{t("minutes", { count: m })}</option>)}
                </Select>
              )}
            </Field>
            <Field label={t("date")} required error={err("date")}>
              {(p) => <Input {...p} type="date" min={today} value={v.date} onChange={(x) => set("date", x.target.value)} />}
            </Field>
            <Field label={t("time")} required error={err("time")}>
              {(p) => <Input {...p} type="time" step={300} value={v.time} onChange={(x) => set("time", x.target.value)} />}
            </Field>
            <Field label={t("agency")} optionalLabel={tc("optional")}>
              {(p) => (
                <Select {...p} value={v.agencyId} onChange={(x) => set("agencyId", x.target.value)}>
                  <option value="">—</option>
                  {options.agencies.map((a) => <option key={a.id} value={a.id}>{a.city} : {a.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label={t("car")} optionalLabel={tc("optional")}>
              {(p) => (
                <Select {...p} value={v.carId} onChange={(x) => set("carId", x.target.value)}>
                  <option value="">—</option>
                  {options.cars.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              )}
            </Field>
            {isAdmin && (
              <Field label={t("assignee")} className="sm:col-span-2">
                {(p) => (
                  <Select {...p} value={v.assignedTo} onChange={(x) => set("assignedTo", x.target.value)}>
                    {options.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                )}
              </Field>
            )}
            <Field label={t("notes")} optionalLabel={tc("optional")} className="sm:col-span-2">
              {(p) => <Textarea {...p} rows={3} value={v.notes} onChange={(x) => set("notes", x.target.value)} />}
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-mist pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
            <Button type="submit" loading={pending}><CalendarPlus />{t("create")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
