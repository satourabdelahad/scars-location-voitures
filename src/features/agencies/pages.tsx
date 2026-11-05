import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { db } from "@/db";
import { tablePreferences } from "@/db/schema";
import type { SessionUser } from "@/server/guards";
import { getAgency, listAgencies } from "@/server/queries/agencies";
import { AgenciesTable } from "./agencies-table";
import { AgencyForm } from "./agency-form";
import { AgencyStatusButton } from "./agency-status";

type Base = "/admin" | "/manager";

export async function AgenciesListPage({ base, me }: { base: Base; me: SessionUser }) {
  const [rows, t, [prefs]] = await Promise.all([
    listAgencies(),
    getTranslations("Agencies"),
    db.select().from(tablePreferences).where(and(eq(tablePreferences.userId, me.id), eq(tablePreferences.tableKey, "agencies"))),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<Button asChild><Link href={`${base}/agencies/new`}><Plus />{t("new")}</Link></Button>} />
      <AgenciesTable rows={rows} base={base} isAdmin={me.role === "admin"} prefs={prefs ? { visibleColumns: prefs.visibleColumns, pageSize: prefs.pageSize } : null} />
    </>
  );
}

export async function NewAgencyPage({ base }: { base: Base }) {
  const t = await getTranslations("Agencies");
  return (
    <>
      <Link href={`${base}/agencies`} className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
      <div className="mt-3"><PageHeader title={t("createTitle")} /></div>
      <AgencyForm base={base} />
    </>
  );
}

export async function AgencyPage({ base, id, me }: { base: Base; id: string; me: SessionUser }) {
  const a = await getAgency(Number(id));
  if (!a) notFound();
  const t = await getTranslations("Agencies");
  return (
    <>
      <Link href={`${base}/agencies`} className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
      <div className="mt-3"><PageHeader title={a.name} subtitle={`${a.city} · ${t("carsCount", { count: a.cars })}`} /></div>
      {!a.isActive && a.deactivationReason && (
        <div className="mb-6 rounded-2xl border border-mist-2 bg-mist/50 px-5 py-4 text-sm text-ink-2">
          <span className="font-semibold text-ink">{t("reason")} :</span> {a.deactivationReason}
        </div>
      )}
      <AgencyForm
        base={base}
        agencyId={a.agencyId}
        readOnly={!a.isActive}
        actions={me.role === "admin" ? <AgencyStatusButton id={a.agencyId} name={a.name} active={a.isActive} /> : undefined}
        initial={{
          name: a.name,
          city: a.city,
          address: a.address,
          phone: a.phone ?? "",
          whatsapp: a.whatsapp ?? "",
          isAirport: a.isAirport,
          managerCivility: a.managerCivility ?? "",
          managerLastName: a.managerLastName ?? "",
          managerFirstName: a.managerFirstName ?? "",
          managerEmail: a.managerEmail ?? "",
          managerPhone: a.managerPhone ?? "",
        }}
      />
    </>
  );
}
