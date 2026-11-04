"use client";

import { AlarmClock, Handshake, MessageCircle, Phone, Plus, Save, Send, StickyNote } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, EmptyState, Panel, type Tone } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { dealSourceEnum, dealTypeEnum, type DealSource, type DealType } from "@/db/schema";
import { promotionLabel } from "@/lib/promotion-label";
import { cn, formatDate, formatDateTime, formatMoney, todayISO } from "@/lib/utils";
import { addDealNote, createDeal, sendDealToClient, updateDeal } from "@/server/actions/deals";
import { casablancaNow } from "@/lib/casablanca-time";
import type { DealRow } from "@/server/queries/manager-profile";
import type { ClientOption } from "@/server/queries/clients";
import { ClientPicker } from "@/features/clients/client-picker";

const TYPES = dealTypeEnum.enumValues;
const SOURCES = dealSourceEnum.enumValues;
export const dealTone: Record<DealType, Tone> = {
  prospect: "info",
  question: "neutral",
  negotiation: "warning",
  rental: "success",
  cancellation: "neutral",
  promotion: "dark",
};

type Options = { cars: { id: string; label: string }[]; promotions: { id: number; code: string; kind: "percent" | "amount"; value: number }[] };
type FormValues = {
  client: ClientOption | null;
  source: DealSource;
  type: DealType;
  contactDate: string;
  contactTime: string;
  carId: string;
  promotionId: string;
  amount: string;
  expectedDate: string;
  nextFollowUp: string;
  nextAction: string;
  notes: string;
};
/** Nouveau prospect : date et heure de l'échange = maintenant (heure du Maroc). */
const empty = (): FormValues => {
  const now = casablancaNow();
  return {
    client: null,
    source: "phone",
    type: "prospect",
    contactDate: now.date,
    contactTime: now.time,
    carId: "",
    promotionId: "",
    amount: "",
    expectedDate: "",
    nextFollowUp: "",
    nextAction: "",
    notes: "",
  };
};
const toForm = (d: DealRow): FormValues => {
  const at = casablancaNow(new Date(d.contactAt));
  return {
    client: d.clientId ? { id: d.clientId, name: d.clientName ?? d.prospectName, email: d.email, phone: d.phone } : null,
    source: d.source,
    type: d.type,
    contactDate: at.date,
    contactTime: at.time,
    carId: d.carId ?? "",
    promotionId: d.promotionId ? String(d.promotionId) : "",
    amount: d.amount != null ? String(d.amount) : "",
    expectedDate: d.expectedDate ?? "",
    nextFollowUp: d.nextFollowUp ?? "",
    nextAction: d.nextAction ?? "",
    notes: d.notes ?? "",
  };
};

/** Onglet "Deals / prospects" : mini CRM du gestionnaire. */
export type DealScope = { managerId?: string; clientId?: string };

export function DealsTab({
  scope,
  deals,
  options,
  prefill,
  showManager = false,
}: {
  /** Fiche gestionnaire (managerId) ou fiche client (clientId) */
  scope: DealScope;
  deals: DealRow[];
  options: Options;
  /** Valeurs pré-remplies pour un nouveau deal (ex. coordonnées du client) */
  prefill?: Partial<FormValues>;
  showManager?: boolean;
}) {
  const t = useTranslations("Deals");
  const tb = useTranslations("Back");
  const locale = useLocale();
  const [type, setType] = useState<DealType | "all">("all");
  const [editing, setEditing] = useState<DealRow | "new" | null>(null);
  const today = todayISO();

  const counts = useMemo(() => Object.fromEntries(TYPES.map((k) => [k, deals.filter((d) => d.type === k).length])), [deals]);
  const pipeline = useMemo(
    () => Object.fromEntries(TYPES.map((k) => [k, deals.filter((d) => d.type === k).reduce((s, d) => s + (d.amount ?? 0), 0)])),
    [deals],
  );
  const filtered = useMemo(() => (type === "all" ? deals : deals.filter((d) => d.type === type)), [deals, type]);
  // Toujours relire la version à jour (après un enregistrement, la liste est rafraîchie par le serveur).
  const current = editing && editing !== "new" ? (deals.find((d) => d.id === editing.id) ?? editing) : editing;

  const columns = useMemo<Column<DealRow>[]>(
    () => [
      {
        id: "prospect",
        header: t("prospectName"),
        text: (d) => `${d.prospectName} ${d.phone} ${d.email ?? ""}`,
        filter: { type: "text" },
        minWidth: 200,
        cell: (d) => (
          <button type="button" onClick={() => setEditing(d)} className="text-start">
            <span className="block font-semibold text-ink hover:text-majorelle">{d.prospectName}</span>
            <span className="text-xs text-ink-3" dir="ltr">{d.phone}</span>
          </button>
        ),
      },
      {
        id: "type",
        header: t("type"),
        text: (d) => t(`types.${d.type}`),
        filter: { type: "select", options: TYPES.map((k) => ({ value: k, label: t(`types.${k}`) })) },
        cell: (d) => <Badge tone={dealTone[d.type]} dot>{t(`types.${d.type}`)}</Badge>,
      },
      ...(showManager ? [{ id: "manager", header: t("followedBy"), text: (d: DealRow) => d.managerName ?? t("administration"), filter: { type: "text" as const } }] : []),
      {
        id: "author",
        header: t("author"),
        addedLater: true,
        text: (d) => (d.authorName ? `${d.authorName} (${d.authorRole === "admin" ? tb("roleAdmin") : tb("roleManager")})` : "—"),
        filter: { type: "text" },
        cell: (d) =>
          d.authorName ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-ink">{d.authorName}</span>
              {d.authorRole && <Badge tone={d.authorRole === "admin" ? "dark" : "info"}>{d.authorRole === "admin" ? tb("roleAdmin") : tb("roleManager")}</Badge>}
            </span>
          ) : (
            "—"
          ),
      },
      { id: "contactAt", addedLater: true, header: t("contactAt"), text: (d) => formatDateTime(d.contactAt, locale), sortValue: (d) => d.contactAt },
      { id: "nextAction", addedLater: true, header: t("nextAction"), text: (d) => d.nextAction ?? "", filter: { type: "text" } },
      { id: "car", header: t("car"), text: (d) => d.car ?? "", filter: { type: "text" }, defaultHidden: true },
      { id: "amount", header: t("amount"), text: (d) => (d.amount != null ? formatMoney(d.amount, locale) : ""), sortValue: (d) => d.amount, align: "end" },
      { id: "promotion", header: t("promotion"), text: (d) => (d.promotion ? promotionLabel(d.promotion) : ""), defaultHidden: true },
      {
        id: "source",
        header: t("prospectionType"),
        text: (d) => t(`sources.${d.source}`),
        filter: { type: "select", options: SOURCES.map((k) => ({ value: k, label: t(`sources.${k}`) })) },
      },
      { id: "city", header: t("city"), text: (d) => d.city ?? "", filter: { type: "text" }, defaultHidden: true },
      {
        id: "nextFollowUp",
        header: t("nextFollowUp"),
        text: (d) => (d.nextFollowUp ? formatDate(d.nextFollowUp, locale) : ""),
        sortValue: (d) => d.nextFollowUp,
        cell: (d) =>
          d.nextFollowUp ? (
            <span className={cn("inline-flex items-center gap-1.5", d.nextFollowUp < today && ["prospect", "negotiation"].includes(d.type) && "font-semibold text-danger")} title={d.nextFollowUp < today ? t("followUpLate") : undefined}>
              {d.nextFollowUp < today && ["prospect", "negotiation"].includes(d.type) && <AlarmClock className="size-3.5" />}
              {formatDate(d.nextFollowUp, locale)}
            </span>
          ) : (
            <span className="text-ink-3">—</span>
          ),
      },
      { id: "updatedAt", header: t("lastUpdate"), text: (d) => formatDateTime(d.updatedAt, locale), sortValue: (d) => d.updatedAt },
    ],
    [t, tb, locale, today, showManager],
  );

  return (
    <div className="space-y-4">
      {/* Entonnoir : un bouton par type d'accord, avec le nombre de deals et le montant estimé */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {(["all", ...TYPES] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            aria-pressed={type === k}
            className={cn(
              "rounded-2xl border p-4 text-start transition-colors",
              type === k ? "border-ink bg-ink text-chalk" : "border-mist bg-paper hover:border-mist-2",
            )}
          >
            <span className={cn("block text-xs font-semibold", type === k ? "text-chalk/70" : "text-ink-3")}>{k === "all" ? t("all") : t(`types.${k}`)}</span>
            <span className="mt-1 block text-2xl font-extrabold tabular" style={{ fontStretch: "112%" }}>{k === "all" ? deals.length : counts[k]}</span>
            {k !== "all" && pipeline[k] > 0 && <span className={cn("block truncate text-xs tabular", type === k ? "text-chalk/70" : "text-ink-3")}>{formatMoney(pipeline[k], locale)}</span>}
          </button>
        ))}
      </div>

      {deals.length === 0 ? (
        <Panel>
          <EmptyState icon={<Handshake />} title={t("emptyTitle")} body={t("empty")} action={<Button onClick={() => setEditing("new")}><Plus />{t("new")}</Button>} />
        </Panel>
      ) : (
        <DataTable
          tableKey="manager-deals"
          columns={columns}
          data={filtered}
          exportTitle={t("title")}
          exportFilename="deals"
          onRowClick={(d) => setEditing(d)}
          toolbar={<Button onClick={() => setEditing("new")}><Plus />{t("new")}</Button>}
        />
      )}

      {current && (
        <DealDialog
          key={current === "new" ? "new" : current.id}
          scope={scope}
          prefill={prefill}
          deal={current === "new" ? null : current}
          options={options}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DealDialog({ scope, prefill, deal, options, onClose }: { scope: DealScope; prefill?: Partial<FormValues>; deal: DealRow | null; options: Options; onClose: () => void }) {
  const t = useTranslations("Deals");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [initial] = useState<FormValues>(() => (deal ? toForm(deal) : { ...empty(), ...prefill }));
  const [v, setV] = useState<FormValues>(initial);
  const [savedId, setSavedId] = useState<string | null>(deal?.id ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [sending, startSend] = useTransition();
  const [noting, startNote] = useTransition();
  const set = <K extends keyof FormValues>(k: K, value: FormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const err = (k: string) => (errors[k] ? te(errors[k] as "required") : undefined);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial) || !savedId;

  /** Enregistre et renvoie l'identifiant du prospect (null en cas d'erreur). */
  async function persist(): Promise<string | null> {
    setErrors({});
    if (!v.client) {
      setErrors({ clientId: "required" });
      return null;
    }
    const payload = { ...v, clientId: v.client.id };
    const res = savedId ? await updateDeal(savedId, payload) : await createDeal(scope, payload);
    if (!res.ok) {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      toast.error(te(res.error as "unknown"));
      return null;
    }
    const id = savedId ?? (res.data as { id: string }).id;
    setSavedId(id);
    return id;
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const id = await persist();
      if (!id) return;
      toast.success(deal ? t("updated") : t("created"));
      router.refresh();
      onClose();
    });
  }

  /** « Envoyer au client » : enregistre d'abord si besoin, puis envoie le récapitulatif par email. */
  function sendToClient() {
    startSend(async () => {
      const id = dirty ? await persist() : savedId;
      if (!id) return;
      const r = await sendDealToClient(id);
      if (r.ok) {
        toast.success(t("sentToClient", { email: r.data!.to }));
        router.refresh();
        onClose();
      } else toast.error(te(r.error as "unknown"));
    });
  }

  function sendNote() {
    if (!deal) return;
    startNote(async () => {
      const res = await addDealNote(deal.id, note);
      if (res.ok) {
        toast.success(t("noteAdded"));
        setNote("");
        router.refresh();
      } else toast.error(res.fieldErrors?.note ? te("minLength", { min: 2 }) : te(res.error as "unknown"));
    });
  }

  const phone = v.client?.phone ?? deal?.phone ?? "";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={deal ? t("editTitle", { name: deal.prospectName }) : t("createTitle")} closeLabel={tc("close")} className="max-h-[calc(100dvh-32px)] max-w-3xl overflow-y-auto">
        <div className={cn("grid gap-6", deal && "lg:grid-cols-[1fr_260px]")}>
          <form onSubmit={save} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("linkedClient")} required hint={scope.clientId ? undefined : t("linkedClientHint")} error={err("clientId")} className="sm:col-span-2">
                {(p) =>
                  scope.clientId && v.client ? (
                    <div className="flex items-center gap-3 rounded-[10px] border border-mist-2 bg-chalk px-3 py-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-majorelle text-xs font-bold text-white">{v.client.name.charAt(0).toUpperCase()}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{v.client.name}</span>
                        <span className="block truncate text-xs text-ink-3" dir="ltr">{[v.client.phone, v.client.email].filter(Boolean).join(" · ")}</span>
                      </span>
                    </div>
                  ) : (
                    <ClientPicker id={p.id} value={v.client} invalid={Boolean(errors.clientId)} onChange={(c) => set("client", c)} />
                  )
                }
              </Field>
              <Field label={t("prospectionType")} required>
                {(p) => (
                  <Select {...p} value={v.source} onChange={(x) => set("source", x.target.value as DealSource)}>
                    {SOURCES.map((k) => <option key={k} value={k}>{t(`sources.${k}`)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label={t("type")} required>
                {(p) => (
                  <Select {...p} value={v.type} onChange={(x) => set("type", x.target.value as DealType)}>
                    {TYPES.map((k) => <option key={k} value={k}>{t(`types.${k}`)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label={t("contactDate")} required error={err("contactDate")}>
                {(p) => <Input {...p} type="date" value={v.contactDate} onChange={(x) => set("contactDate", x.target.value)} />}
              </Field>
              <Field label={t("contactTime")} required error={err("contactTime")}>
                {(p) => <Input {...p} type="time" value={v.contactTime} onChange={(x) => set("contactTime", x.target.value)} />}
              </Field>
              <Field label={t("notes")} optionalLabel={tc("optional")} className="sm:col-span-2">
                {(p) => <Textarea {...p} rows={3} value={v.notes} onChange={(x) => set("notes", x.target.value)} />}
              </Field>
              <Field label={t("nextAction")} optionalLabel={tc("optional")} error={err("nextAction")} className="sm:col-span-2">
                {(p) => <Input {...p} value={v.nextAction} placeholder={t("nextActionPlaceholder")} onChange={(x) => set("nextAction", x.target.value)} />}
              </Field>
              <Field label={t("nextFollowUp")} optionalLabel={tc("optional")} error={err("nextFollowUp")}>
                {(p) => <Input {...p} type="date" value={v.nextFollowUp} onChange={(x) => set("nextFollowUp", x.target.value)} />}
              </Field>
              <Field label={t("car")} optionalLabel={tc("optional")}>
                {(p) => (
                  <Select {...p} value={v.carId} onChange={(x) => set("carId", x.target.value)}>
                    <option value="">—</option>
                    {options.cars.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                )}
              </Field>
              <Field label={t("promotion")} optionalLabel={tc("optional")}>
                {(p) => (
                  <Select {...p} value={v.promotionId} onChange={(x) => set("promotionId", x.target.value)} dir="ltr">
                    <option value="">—</option>
                    {options.promotions.map((pr) => <option key={pr.id} value={pr.id}>{promotionLabel(pr)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label={t("amount")} optionalLabel={tc("optional")} error={err("amount")}>
                {(p) => <Input {...p} type="number" min={0} step={50} value={v.amount} onChange={(x) => set("amount", x.target.value)} />}
              </Field>
              <Field label={t("expectedDate")} optionalLabel={tc("optional")} error={err("expectedDate")}>
                {(p) => <Input {...p} type="date" value={v.expectedDate} onChange={(x) => set("expectedDate", x.target.value)} />}
              </Field>
            </div>
            {deal?.sentToClientAt && <p className="text-xs text-ink-3">{t("lastSent", { date: formatDateTime(deal.sentToClientAt, locale) })}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-mist pt-4">
              {phone ? (
                <div className="flex gap-1">
                  <a href={`tel:${phone}`} className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-chalk" aria-label={t("phone")} title={t("phone")}><Phone className="size-4" /></a>
                  <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noopener" className="grid size-9 place-items-center rounded-lg text-palm hover:bg-palm-soft" aria-label="WhatsApp" title="WhatsApp"><MessageCircle className="size-4" /></a>
                </div>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
                <Button type="submit" loading={pending} disabled={sending}>
                  <Save />
                  {pending ? tc("saving") : tc("save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  loading={sending}
                  disabled={pending || !v.client?.email}
                  title={v.client && !v.client.email ? t("noClientEmail") : undefined}
                  onClick={sendToClient}
                >
                  <Send />
                  {t("sendToClient")}
                </Button>
              </div>
            </div>
          </form>

          {deal && (
            <aside className="space-y-4 lg:border-s lg:border-mist lg:ps-6">
              <div>
                <p className="mb-2 text-sm font-bold text-ink">{t("addNote")}</p>
                <Textarea value={note} onChange={(x) => setNote(x.target.value)} rows={3} placeholder={t("notePlaceholder")} aria-label={t("addNote")} />
                <Button size="sm" variant="outline" className="mt-2 w-full" loading={noting} disabled={note.trim().length < 2} onClick={sendNote}>
                  <StickyNote />
                  {t("addNote")}
                </Button>
              </div>
              <div>
                <p className="mb-3 text-sm font-bold text-ink">{t("timeline")}</p>
                <ol className="space-y-3 border-s-2 border-mist ps-4">
                  {deal.events.map((ev) => (
                    <li key={ev.id} className="relative">
                      <span className="absolute -start-[23px] top-1 size-2.5 rounded-full bg-saffron ring-4 ring-paper" aria-hidden />
                      <p className="text-sm font-semibold text-ink">
                        {ev.fromType == null && ev.toType
                          ? `${t("created")} : ${t(`types.${ev.toType}`)}`
                          : ev.fromType !== ev.toType && ev.fromType && ev.toType
                            ? `${t(`types.${ev.fromType}`)} → ${t(`types.${ev.toType}`)}`
                            : t("noteLabel")}
                      </p>
                      {ev.note && <p className="mt-0.5 text-sm whitespace-pre-line text-ink-2">{ev.note}</p>}
                      <p className="mt-0.5 text-xs text-ink-3">{formatDateTime(ev.at, locale)}{ev.actor ? ` · ${ev.actor}` : ""}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
