import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BarChart3, CarFront, IdCard, Plus, UserRoundCog, UsersRound, Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { db } from "@/db";
import { tablePreferences } from "@/db/schema";
import { cn, formatMoney } from "@/lib/utils";
import type { SessionUser } from "@/server/guards";
import { agencyManagers, agencyStats, getAgency, listAgencies, managerChoices } from "@/server/queries/agencies";
import { listFleet } from "@/server/queries/fleet";
import { FleetTable } from "@/features/fleet/fleet-table";
import { ManagerAvatar } from "@/features/managers/manager-avatar";
import { AgenciesTable } from "./agencies-table";
import { AgencyForm } from "./agency-form";
import { AgencyStatusButton } from "./agency-status";
import { ManagerPicker, type PickerPerson } from "./manager-picker";

type Base = "/admin" | "/manager";
const TABS = ["stats", "infos", "manager", "managers", "cars"] as const;
export type AgencyTab = (typeof TABS)[number];
export const parseAgencyTab = (v: unknown): AgencyTab => (TABS.includes(v as AgencyTab) ? (v as AgencyTab) : "stats");

export async function AgenciesListPage({ base, me }: { base: Base; me: SessionUser }) {
  const [rows, t, [prefs]] = await Promise.all([
    listAgencies(),
    getTranslations("Agencies"),
    db.select().from(tablePreferences).where(and(eq(tablePreferences.userId, me.id), eq(tablePreferences.tableKey, "agencies"))),
  ]);
  const isAdmin = me.role === "admin";
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={isAdmin ? t("subtitle") : t("readOnlySubtitle")}
        actions={isAdmin ? <Button asChild><Link href={`${base}/agencies/new`}><Plus />{t("new")}</Link></Button> : undefined}
      />
      <AgenciesTable rows={rows} base={base} isAdmin={isAdmin} prefs={prefs ? { visibleColumns: prefs.visibleColumns, pageSize: prefs.pageSize } : null} />
    </>
  );
}

/** Nouvelle agence (administrateur). */
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Panel className="p-5">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-ink tabular" style={{ fontStretch: "112%" }}>{value}</p>
    </Panel>
  );
}

/** Page d'une agence : en-tête (voitures, gestionnaires) puis onglets. Lecture seule pour les gestionnaires. */
export async function AgencyPage({ base, id, me, tab, locale }: { base: Base; id: string; me: SessionUser; tab: AgencyTab; locale: string }) {
  const a = await getAgency(Number(id));
  if (!a) notFound();
  const isAdmin = me.role === "admin";
  const [t, tm, c, stats, linked, managers] = await Promise.all([
    getTranslations("Agencies"),
    getTranslations("Managers"),
    getTranslations("Common"),
    agencyStats(a.agencyId),
    agencyManagers(a.agencyId),
    managerChoices(),
  ]);
  const path = `${base}/agencies/${a.agencyId}`;
  const tabs = [
    { id: "stats" as const, label: t("tabStats"), Icon: BarChart3 },
    { id: "infos" as const, label: t("tabInfos"), Icon: IdCard },
    { id: "manager" as const, label: t("tabResponsibles", { count: a.responsibles.length }), Icon: UserRoundCog },
    { id: "managers" as const, label: t("tabManagers", { count: linked.length }), Icon: UsersRound },
    { id: "cars" as const, label: t("tabCars", { count: stats.cars }), Icon: CarFront },
  ];
  const initial = {
    name: a.name,
    city: a.city,
    address: a.address,
    phone: a.phone ?? "",
    whatsapp: a.whatsapp ?? "",
    isAirport: a.isAirport,
    websiteUrl: a.websiteUrl ?? "",
    facebookUrl: a.facebookUrl ?? "",
    instagramUrl: a.instagramUrl ?? "",
    linkedinUrl: a.linkedinUrl ?? "",
    xUrl: a.xUrl ?? "",
  };

  // Personnes proposées dans les onglets Responsable(s) et Gestionnaires.
  const info = new Map(linked.map((m) => [m.id, m]));
  const people = (badges: (id: string) => PickerPerson["badges"]) =>
    managers.map((m) => ({ ...m, badges: badges(m.id) }));
  const responsibleIds = a.responsibles.map((r) => r.id);
  const memberIds = linked.filter((m) => m.member && !m.isAdmin).map((m) => m.id);
  const adminIds = managers.filter((m) => m.isAdmin).map((m) => m.id);

  let body: React.ReactNode;
  if (tab === "infos") {
    body = (
      <AgencyForm
        base={base}
        agencyId={a.agencyId}
        readOnly={!isAdmin || !a.isActive}
        actions={isAdmin ? <AgencyStatusButton id={a.agencyId} name={a.name} active={a.isActive} /> : undefined}
        initial={initial}
      />
    );
  } else if (tab === "manager") {
    body = (
      <>
        <p className="mb-3 text-sm text-ink-3">{t("responsiblesHint")}</p>
        <ManagerPicker
          key="responsible"
          agencyId={a.agencyId}
          kind="responsible"
          base={base}
          readOnly={!isAdmin || !a.isActive}
          initial={responsibleIds}
          people={people((id) => (managers.find((m) => m.id === id)?.isAdmin ? [{ label: t("adminBadge"), tone: "dark" }] : []))}
        />
      </>
    );
  } else if (tab === "managers" && isAdmin) {
    body = (
      <>
        <p className="mb-3 text-sm text-ink-3">{t("membersHint")}</p>
        <ManagerPicker
          key="member"
          agencyId={a.agencyId}
          kind="member"
          base={base}
          readOnly={!a.isActive}
          initial={memberIds.filter((id) => !responsibleIds.includes(id))}
          locked={[...responsibleIds, ...adminIds]}
          lockedHint={t("membersLockedHint")}
          people={people((id) => {
            const m = info.get(id);
            const out: NonNullable<PickerPerson["badges"]> = [];
            if (responsibleIds.includes(id)) out.push({ label: t("responsible"), tone: "dark" });
            if (adminIds.includes(id)) out.push({ label: t("adminBadge"), tone: "dark" });
            if (m?.byRule) out.push({ label: tm("byRule"), tone: "info" });
            if (m && m.cars > 0) out.push({ label: tm("carsCount", { count: m.cars }), tone: "neutral" });
            return out;
          })}
        />
      </>
    );
  } else if (tab === "managers") {
    body = linked.length ? (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {linked.map((m) => (
          <li key={m.id}>
            <Link href={`${base}/managers/${m.id}`} className={cn("flex items-center gap-3 rounded-xl border border-mist bg-paper p-3 hover:border-mist-2", !m.active && "opacity-60")}>
              <ManagerAvatar photoUrl={m.photoUrl} firstName={m.firstName} lastName={m.lastName} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{m.firstName} {m.lastName}</span>
                <span className="block truncate text-xs text-ink-3" dir="ltr">{m.email ?? m.phone}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {m.responsible && <Badge tone="dark">{t("responsible")}</Badge>}
                  {m.isAdmin && <Badge tone="dark">{t("adminBadge")}</Badge>}
                  {m.member && !m.responsible && !m.isAdmin && <Badge tone="success">{t("memberBadge")}</Badge>}
                  {m.byRule && <Badge tone="info">{tm("byRule")}</Badge>}
                  {m.cars > 0 && <Badge tone="neutral">{tm("carsCount", { count: m.cars })}</Badge>}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <Panel><EmptyState icon={<UsersRound />} title={t("noManagers")} body={t("noManagersBody")} /></Panel>
    );
  } else if (tab === "cars") {
    const fleet = (await listFleet()).filter((f) => f.agencyId === a.agencyId);
    body = <FleetTable rows={fleet} base={base} prefs={null} tableKey="agency-cars" />;
  } else {
    body = (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("statCars")} value={stats.cars} />
        <Stat label={t("statOnRoad")} value={stats.onRoad} />
        <Stat label={t("statMaintenance")} value={stats.maintenance} />
        <Stat label={t("statManagers")} value={linked.length} />
        <Stat label={t("statRentals")} value={stats.rentals} />
        <Stat label={t("statRevenue")} value={formatMoney(stats.revenue, locale)} />
        <Stat label={t("statRentals30")} value={stats.rentals30} />
        <Stat label={t("statRevenue30")} value={formatMoney(stats.revenue30, locale)} />
      </div>
    );
  }

  return (
    <>
      <Link href={`${base}/agencies`} className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
      <div className="mt-3 mb-5 flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-majorelle-soft text-majorelle"><Building2 className="size-6" /></span>
        <div className="min-w-[min(100%,14rem)] flex-1">
          <h1 className="display-md text-2xl text-ink sm:text-3xl">{a.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={a.isActive ? "success" : "neutral"} dot>{a.isActive ? c("active") : c("deactivated")}</Badge>
            {a.isAirport && <Badge tone="info">{t("airport")}</Badge>}
            <span className="text-sm text-ink-3">{a.city} · {a.address}</span>
          </div>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:max-w-md">
        <div className="rounded-xl border border-mist bg-paper px-4 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{t("cars")}</p>
          <p className="text-xl font-extrabold text-ink tabular">{stats.cars}</p>
        </div>
        <div className="rounded-xl border border-mist bg-paper px-4 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{t("statManagers")}</p>
          <p className="text-xl font-extrabold text-ink tabular">{linked.length}</p>
        </div>
      </div>
      {!a.isActive && a.deactivationReason && (
        <div className="mb-6 rounded-2xl border border-mist-2 bg-mist/50 px-5 py-4 text-sm text-ink-2">
          <span className="font-semibold text-ink">{t("reason")} :</span> {a.deactivationReason}
        </div>
      )}
      <nav aria-label={a.name} className="scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-mist">
        {tabs.map(({ id: tid, label, Icon }) => (
          <Link
            key={tid}
            href={tid === "stats" ? path : `${path}?tab=${tid}`}
            aria-current={tab === tid ? "page" : undefined}
            className={cn("-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors", tab === tid ? "border-majorelle text-majorelle" : "border-transparent text-ink-3 hover:text-ink")}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      {body}
    </>
  );
}
