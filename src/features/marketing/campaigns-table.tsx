"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/misc";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { CampaignRow } from "@/server/queries/marketing";

/** Historique des campagnes : envois, clics (code attribué) et codes utilisés pour réserver. */
export function CampaignsTable({ rows }: { rows: CampaignRow[] }) {
  const t = useTranslations("Marketing");
  const locale = useLocale();
  const columns = useMemo<Column<CampaignRow>[]>(
    () => [
      { id: "createdAt", header: t("colDate"), text: (r) => formatDateTime(r.createdAt, locale), sortValue: (r) => r.createdAt, minWidth: 160 },
      { id: "name", header: t("campaignName"), text: (r) => r.name, filter: { type: "text" }, cell: (r) => <span className="font-semibold text-ink">{r.name}</span> },
      { id: "code", header: t("colCode"), text: (r) => r.code, filter: { type: "text" }, cell: (r) => <span dir="ltr" className="rounded-md border border-mist-2 bg-chalk px-2 py-0.5 font-mono text-xs text-ink">{r.code}</span> },
      { id: "percent", header: t("percent"), text: (r) => `-${r.percent} %`, sortValue: (r) => r.percent, align: "end" },
      { id: "endsOn", header: t("endsOn"), text: (r) => (r.endsOn ? formatDate(r.endsOn, locale) : "—"), sortValue: (r) => r.endsOn },
      { id: "sent", header: t("colSent"), text: (r) => `${r.sent} / ${r.recipients}`, sortValue: (r) => r.sent, align: "end", cell: (r) => <span className="tabular">{r.sent} / {r.recipients}{r.failed > 0 && <Badge tone="danger" className="ms-1.5">{r.failed}</Badge>}</span> },
      { id: "clicked", header: t("colClicked"), text: (r) => String(r.clicked), sortValue: (r) => r.clicked, align: "end" },
      { id: "used", header: t("colUsed"), text: (r) => String(r.used), sortValue: (r) => r.used, align: "end", cell: (r) => (r.used ? <Badge tone="success">{r.used}</Badge> : "0") },
      { id: "author", header: t("colAuthor"), text: (r) => r.author ?? "—", filter: { type: "text" } },
    ],
    [t, locale],
  );
  return <DataTable tableKey="marketing-campaigns" columns={columns} data={rows} initialPrefs={null} exportTitle={t("historyTitle")} exportFilename="campagnes-email" />;
}
