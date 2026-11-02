import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge, DefinitionList, Panel } from "@/components/ui/misc";
import { requireRole } from "@/server/guards";
import { getManager, managerRentalCounts } from "@/server/queries/managers";
import { formatDate, formatDateTime, initials } from "@/lib/utils";
import type { DocumentKind } from "@/db/schema";
import { ManagerActions, DocumentLink } from "./manager-actions";
import { ManagerCardExport } from "../managers-table";

const DOC_KINDS: DocumentKind[] = ["cin_front", "cin_back", "license_front", "license_back"];

export default async function ManagerDetailPage({ params }: PageProps<"/[locale]/admin/managers/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"]);
  const m = await getManager(id);
  if (!m) notFound();
  const [t, td, c, e, counts] = await Promise.all([
    getTranslations("Managers"),
    getTranslations("Documents"),
    getTranslations("Common"),
    getTranslations("Enums"),
    managerRentalCounts(m.userId),
  ]);
  const name = `${m.firstName} ${m.lastName}`;
  const row = {
    id: m.id,
    civility: m.civility,
    lastName: m.lastName,
    firstName: m.firstName,
    email: m.user.email ?? "",
    phone: m.phone,
    whatsapp: m.whatsapp,
    city: m.city,
    birthDate: m.birthDate,
    maritalStatus: m.maritalStatus,
    workStartDate: m.workStartDate,
    contractType: m.contractType,
    status: m.status,
    deactivationReason: m.deactivationReason,
    lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
    adminUpdatedAt: m.adminUpdatedAt?.toISOString() ?? null,
    rentalsDay: counts.d,
    rentalsWeek: counts.w,
    rentalsMonth: counts.m,
    rentalsYear: counts.y,
  };

  return (
    <>
      <Link href="/admin/managers" className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
      <div className="mt-3 mb-6 flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-ink text-lg font-bold text-chalk" style={{ fontStretch: "120%" }}>
          {initials(m.firstName, m.lastName)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="display-md text-3xl text-ink">{name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={m.status === "active" ? "success" : "neutral"} dot>{m.status === "active" ? c("active") : c("deactivated")}</Badge>
            <Badge tone="info">{e(`contract.${m.contractType}`)}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ManagerCardExport manager={row} size="md" />
          {m.status === "active" && (
            <Button asChild variant="outline"><Link href={`/admin/managers/${m.id}/edit`}><Pencil />{c("edit")}</Link></Button>
          )}
          <ManagerActions id={m.id} name={name} status={m.status} canResendInvite={!m.user.hasPassword && m.status === "active"} />
        </div>
      </div>

      {m.status === "deactivated" && (
        <div className="mb-6 rounded-2xl border border-mist-2 bg-mist/50 px-5 py-4">
          <p className="font-semibold text-ink">{t("deactivatedOn", { date: formatDate(m.deactivatedAt, locale) })}</p>
          <p className="mt-1 text-sm text-ink-2">{t("deactivationReason")} : {m.deactivationReason}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [t("rentalsDay"), counts.d],
          [t("rentalsWeek"), counts.w],
          [t("rentalsMonth"), counts.m],
          [t("rentalsYear"), counts.y],
        ].map(([label, value]) => (
          <Panel key={String(label)} className="p-5">
            <p className="text-xs font-medium text-ink-3">{label}</p>
            <p className="mt-2 text-3xl font-extrabold text-ink tabular" style={{ fontStretch: "115%" }}>{value}</p>
          </Panel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Panel className="p-6">
            <h2 className="mb-5 font-bold text-ink">{t("identity")}</h2>
            <DefinitionList
              items={[
                { label: t("civility"), value: e(`civility.${m.civility}`) },
                { label: t("lastName"), value: m.lastName },
                { label: t("firstName"), value: m.firstName },
                { label: t("birthDate"), value: formatDate(m.birthDate, locale) },
                { label: t("maritalStatus"), value: m.maritalStatus ? e(`marital.${m.maritalStatus}`) : "—" },
                { label: t("city"), value: m.city },
                { label: t("email"), value: <a href={`mailto:${m.user.email}`} dir="ltr" className="hover:text-majorelle">{m.user.email}</a> },
                { label: t("phone"), value: <a href={`tel:${m.phone}`} dir="ltr" className="hover:text-majorelle">{m.phone}</a> },
                { label: t("whatsapp"), value: <a href={`https://wa.me/${m.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener" dir="ltr" className="text-palm hover:underline">{m.whatsapp}</a> },
                { label: t("workStartDate"), value: formatDate(m.workStartDate, locale) },
                { label: t("contractType"), value: e(`contract.${m.contractType}`) },
              ]}
            />
          </Panel>
          <Panel className="p-6">
            <h2 className="font-bold text-ink">{t("documents")}</h2>
            <p className="mt-1 mb-5 text-sm text-ink-3">{td("privateNote")}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {DOC_KINDS.map((k) => {
                const doc = m.documents.find((d) => d.kind === k);
                return (
                  <li key={k} className="flex items-center justify-between gap-3 rounded-xl border border-mist px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{td(k)}</span>
                      <span className="text-xs text-ink-3">{doc ? formatDateTime(doc.uploadedAt, locale) : td("missing")}</span>
                    </span>
                    {doc && <DocumentLink managerId={m.id} kind={k} />}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-6">
            <h2 className="mb-5 font-bold text-ink">{t("tracking")}</h2>
            <DefinitionList
              className="sm:grid-cols-1"
              items={[
                { label: `${t("lastLogin")} (${c("readOnly")})`, value: m.user.lastLoginAt ? formatDateTime(m.user.lastLoginAt, locale) : c("never") },
                { label: `${t("adminUpdatedAt")} (${c("readOnly")})`, value: formatDateTime(m.adminUpdatedAt, locale) },
              ]}
            />
          </Panel>
          <Panel className="p-6">
            <h2 className="mb-5 font-bold text-ink">{t("history")}</h2>
            <ol className="relative space-y-5 border-s border-mist-2 ps-5">
              {m.events.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className={`absolute -start-[25px] top-1 size-2.5 rounded-full ring-4 ring-paper ${ev.event === "deactivated" ? "bg-danger" : ev.event === "reactivated" ? "bg-palm" : "bg-majorelle"}`} aria-hidden />
                  <p className="text-sm font-semibold text-ink">{t(`event.${ev.event}`)}</p>
                  <p className="text-xs text-ink-3">{formatDateTime(ev.createdAt, locale)}{ev.actor ? ` · ${ev.actor.name ?? ev.actor.email}` : ""}</p>
                  {ev.reason && <p className="mt-1 text-sm text-ink-2">{ev.reason}</p>}
                  {ev.changes && (
                    <p className="mt-1 text-xs text-ink-3">{Object.keys(ev.changes).map((k) => (k.startsWith("document:") ? td(k.slice(9) as "cin_front") : t(k as "city"))).join(", ")}</p>
                  )}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
