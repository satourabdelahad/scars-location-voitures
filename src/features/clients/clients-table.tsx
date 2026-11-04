"use client";

import { CarFront, Handshake, History, UserRoundX, UsersRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Badge, type Tone } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { ClientRow, ClientSegment } from "@/server/queries/clients";
import { ClientStatusButton } from "./client-status";

const SEGMENTS: { id: ClientSegment; Icon: typeof CarFront; tone: Tone }[] = [
  { id: "renting", Icon: CarFront, tone: "dark" },
  { id: "negotiating", Icon: Handshake, tone: "warning" },
  { id: "rented", Icon: History, tone: "success" },
  { id: "never", Icon: UserRoundX, tone: "neutral" },
];
export const segmentTone = Object.fromEntries(SEGMENTS.map((s) => [s.id, s.tone])) as Record<ClientSegment, Tone>;

/** Liste des clients : compteurs par segment (cliquables pour filtrer) puis tableau. */
export function ClientsTable({ rows, base }: { rows: ClientRow[]; base: string }) {
  const t = useTranslations("Clients");
  const c = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const [segment, setSegment] = useState<ClientSegment | "all">("all");
  const counts = useMemo(() => Object.fromEntries(SEGMENTS.map((s) => [s.id, rows.filter((r) => r.segment === s.id).length])), [rows]);
  const data = useMemo(() => (segment === "all" ? rows : rows.filter((r) => r.segment === segment)), [rows, segment]);

  const columns = useMemo<Column<ClientRow>[]>(
    () => [
      {
        id: "lastName",
        header: t("lastName"),
        text: (r) => r.lastName,
        filter: { type: "text" },
        cell: (r) => <Link href={`${base}/clients/${r.id}`} className="font-semibold text-ink underline-offset-4 hover:text-majorelle hover:underline">{r.lastName || "—"}</Link>,
      },
      {
        id: "firstName",
        header: t("firstName"),
        text: (r) => r.firstName,
        filter: { type: "text" },
        cell: (r) => <Link href={`${base}/clients/${r.id}`} className="font-medium text-ink underline-offset-4 hover:text-majorelle hover:underline">{r.firstName || "—"}</Link>,
      },
      {
        id: "segment",
        header: t("segment"),
        text: (r) => t(`seg.${r.segment}`),
        filter: { type: "select", options: SEGMENTS.map((s) => ({ value: t(`seg.${s.id}`), label: t(`seg.${s.id}`) })) },
        cell: (r) => <Badge tone={segmentTone[r.segment]} dot>{t(`seg.${r.segment}`)}</Badge>,
      },
      { id: "phone", header: t("phone"), text: (r) => r.phone ?? "", filter: { type: "text" }, cell: (r) => (r.phone ? <a href={`tel:${r.phone}`} dir="ltr" className="tabular hover:text-majorelle">{r.phone}</a> : "—") },
      { id: "email", header: t("email"), text: (r) => r.email ?? "", filter: { type: "text" }, cell: (r) => (r.email ? <a href={`mailto:${r.email}`} dir="ltr" className="hover:text-majorelle">{r.email}</a> : "—") },
      { id: "city", header: t("city"), text: (r) => r.city ?? "", filter: { type: "text" }, defaultHidden: true },
      { id: "rentals", header: t("rentals"), text: (r) => String(r.rentals), sortValue: (r) => r.rentals, align: "end" },
      { id: "totalSpent", header: t("totalSpent"), text: (r) => formatMoney(r.totalSpent, locale), sortValue: (r) => r.totalSpent, align: "end" },
      { id: "lastRental", header: t("lastRental"), text: (r) => (r.lastRental ? formatDate(r.lastRental, locale) : ""), sortValue: (r) => r.lastRental },
      { id: "openDeals", header: t("openDeals"), text: (r) => String(r.openDeals), sortValue: (r) => r.openDeals, align: "end", defaultHidden: true },
      { id: "createdAt", header: t("createdAt"), text: (r) => formatDate(r.createdAt, locale), sortValue: (r) => r.createdAt, defaultHidden: true },
      {
        id: "status",
        header: c("status"),
        text: (r) => (r.status === "active" ? c("active") : c("deactivated")),
        filter: { type: "select", options: [{ value: c("active"), label: c("active") }, { value: c("deactivated"), label: c("deactivated") }] },
        cell: (r) => <Badge tone={r.status === "active" ? "success" : "neutral"} dot>{r.status === "active" ? c("active") : c("deactivated")}</Badge>,
      },
      {
        id: "actions",
        header: "",
        text: () => "",
        isAction: true,
        cell: (r) => <ClientStatusButton id={r.id} name={`${r.firstName} ${r.lastName}`} status={r.status} compact />,
      },
    ],
    [t, c, locale, base],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setSegment("all")}
          aria-pressed={segment === "all"}
          className={cn("col-span-2 rounded-2xl border p-5 text-start transition-colors lg:col-span-1", segment === "all" ? "border-ink bg-ink text-chalk" : "border-mist bg-paper hover:border-mist-2")}
        >
          <span className={cn("flex items-center gap-2 text-xs font-semibold", segment === "all" ? "text-chalk/70" : "text-ink-3")}><UsersRound className="size-4" />{t("all")}</span>
          <span className="mt-2 block text-3xl font-extrabold tabular" style={{ fontStretch: "112%" }}>{rows.length}</span>
        </button>
        {SEGMENTS.map(({ id, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSegment(id)}
            aria-pressed={segment === id}
            className={cn("rounded-2xl border p-5 text-start transition-colors", segment === id ? "border-ink bg-ink text-chalk" : "border-mist bg-paper hover:border-mist-2")}
          >
            <span className={cn("flex items-center gap-2 text-xs font-semibold", segment === id ? "text-chalk/70" : "text-ink-3")}><Icon className="size-4" />{t(`seg.${id}`)}</span>
            <span className="mt-2 block text-3xl font-extrabold tabular" style={{ fontStretch: "112%" }}>{counts[id]}</span>
          </button>
        ))}
      </div>
      <DataTable tableKey="clients" columns={columns} data={data} exportTitle={t("title")} exportFilename="clients" onRowClick={(r) => router.push(`${base}/clients/${r.id}`)} />
    </div>
  );
}
