import Image from "next/image";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Building2, CalendarDays, ClipboardCheck, ClipboardList, Droplets, Lock, Plus, ShieldCheck, Stamp, Table2, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { tablePreferences } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { localeMeta, type Locale } from "@/i18n/config";
import { CarArt } from "@/components/car-art";
import { Button } from "@/components/ui/button";
import { Badge, DefinitionList, EmptyState, PageHeader, Panel } from "@/components/ui/misc";
import { allAgencies, carSummary, getFleetCar, inScope, listFleet, managerOptions } from "@/server/queries/fleet";
import { managerRentals } from "@/server/queries/manager-profile";
import { currentAgencyScope } from "@/server/agency-scope";
import { getAlertSettings } from "@/server/app-settings";
import { carFinance, carInspectionsFor, carRecordsFor, inspectableReservations } from "@/server/queries/car-file";
import type { CarRecordKind } from "@/db/schema";
import { CarRecordsTab } from "./car-file/records-tab";
import { InspectionsTab } from "./car-file/inspections-tab";
import { FinancePanel } from "./car-file/finance-panel";
import { CarCalendar, FleetCalendar } from "./car-file/calendar";
import { CarHeader, CarStats } from "./car-header";
import { RentalsTab } from "@/features/managers/rentals-tab";
import { ReservationsTable } from "@/features/reservations/reservations-table";
import { listReservationsForStaff } from "@/server/queries/reservations";
import { auth } from "@/auth";
import { RentalsChart } from "@/features/my/rentals-chart";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { FleetTable } from "./fleet-table";
import { CarPromotion } from "./car-promotion";
import { CarForm } from "./car-form";
import { DeactivateCarButton } from "./deactivate-car";
import { RepairButton } from "./repair-button";
import { CAR_STATES, carState, STATE_TONE } from "@/lib/car-state";
import type { CarView } from "@/lib/car-views";

type Base = "/admin" | "/manager";

export async function FleetListPage({ base, userId, view = "table" }: { base: Base; userId: string; view?: "table" | "calendar" }) {
  const t = await getTranslations("Fleet");
  const [all, [prefs], scope] = await Promise.all([
    listFleet(),
    db.select().from(tablePreferences).where(and(eq(tablePreferences.userId, userId), eq(tablePreferences.tableKey, "fleet"))),
    currentAgencyScope(),
  ]);
  // Gestionnaire rattaché à des agences : seulement les voitures de son périmètre.
  const rows = all.filter((r) => inScope(r, scope));
  const stats = CAR_STATES.map((s) => ({ label: t(`state.${s}`), value: rows.filter((r) => carState(r) === s).length, tone: STATE_TONE[s] }));
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<Button asChild><Link href={`${base}/fleet/new`}><Plus />{t("new")}</Link></Button>}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Panel key={s.label} className="p-5">
            <p className="text-xs font-medium text-ink-3">{s.label}</p>
            <p className="mt-2 text-3xl font-extrabold text-ink tabular" style={{ fontStretch: "115%" }}>{s.value}</p>
          </Panel>
        ))}
      </div>
      {/* Vue tableau ou vue calendrier (planning de toutes les voitures) */}
      <div role="tablist" aria-label={t("viewMode")} className="mb-4 inline-flex rounded-xl bg-mist/60 p-1 text-sm font-semibold">
        {(["table", "calendar"] as const).map((v) => (
          <Link
            key={v}
            role="tab"
            aria-selected={view === v}
            href={v === "table" ? `${base}/fleet` : `${base}/fleet?view=calendar`}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors ${view === v ? "bg-paper text-ink shadow-sm" : "text-ink-3 hover:text-ink"}`}
          >
            {v === "table" ? <Table2 className="size-4" /> : <CalendarDays className="size-4" />}
            {t(v === "table" ? "viewTable" : "viewCalendar")}
          </Link>
        ))}
      </div>
      {view === "calendar" ? (
        <FleetCalendar
          base={base}
          cars={rows.filter((r) => r.status !== "deactivated").map((r) => ({ id: r.id, brand: r.brand, model: r.model, plateNumber: r.plateNumber, status: r.status, city: r.city }))}
        />
      ) : (
        <FleetTable
          rows={rows}
          base={base}
          prefs={prefs ? { visibleColumns: prefs.visibleColumns, pageSize: prefs.pageSize } : null}
          bulk={{ agencies: await allAgencies(), managers: await managerOptions(), canAssign: base === "/admin" }}
        />
      )}
    </>
  );
}

export async function NewCarPage({ base }: { base: Base }) {
  const t = await getTranslations("Fleet");
  const agencies = await allAgencies();
  return (
    <>
      <Link href={`${base}/fleet`} className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
      <PageHeader title={t("createTitle")} />
      {agencies.length === 0 ? (
        // Une voiture est rattachée à une agence : il faut en créer une d'abord.
        <Panel>
          <EmptyState
            icon={<Building2 />}
            title={t("noAgencyTitle")}
            body={base === "/admin" ? t("noAgencyBody") : t("noAgencyBodyManager")}
            action={base === "/admin" ? <Button asChild><Link href={`${base}/agencies/new`}><Plus />{t("addAgency")}</Link></Button> : undefined}
          />
        </Panel>
      ) : (
        <CarForm base={base} agencies={agencies} managers={await managerOptions()} />
      )}
    </>
  );
}

export async function CarDetailPage({ base, id, locale, query = {} }: { base: Base; id: string; locale: string; query?: { tab?: string; new?: string; reservation?: string } }) {
  const car = await getFleetCar(id);
  if (!car) notFound();
  const [t, e, summary, rentals, fleet] = await Promise.all([
    getTranslations("Fleet"),
    getTranslations("Enums"),
    carSummary(car.id),
    managerRentals(null, { carId: car.id }),
    listFleet(),
  ]);
  const name = `${car.brand} ${car.model}`;
  const scope = await currentAgencyScope();
  const row = fleet.find((f) => f.id === car.id);
  const outOfScope = Boolean(row && !inScope(row, scope));
  const header = (actions?: React.ReactNode) => (
    <CarHeader
      car={{ brand: car.brand, model: car.model, year: car.year, plateNumber: car.plateNumber, category: car.category, colorHex: car.colorHex, dailyPrice: car.dailyPrice, promoPercent: car.promoPercent, promoStartsOn: car.promoStartsOn, promoEndsOn: car.promoEndsOn, mileage: car.mileage, status: car.status, cover: car.images[0]?.url ?? null, city: car.agency.city, agency: car.agency.name }}
      summary={summary}
      onRoad={row?.onRoad ?? false}
      locale={locale}
      actions={actions}
    />
  );
  const historyTab = <RentalsTab rows={rentals} reservationsBase={`${base}/reservations`} showHandler />;
  const statsTab = (
    <div className="space-y-4">
      <CarStats summary={summary} locale={locale} />
      <RentalsChart rows={rentals} />
    </div>
  );

  // Dossier de la voiture : assurance, vignette, vidange, visite technique, états des lieux, rentabilité, planning.
  const [records, inspections, inspectable, finance, alertCfg, tf, carReservations, session] = await Promise.all([
    carRecordsFor(car.id),
    carInspectionsFor(car.id),
    inspectableReservations(car.id),
    carFinance(car.id),
    getAlertSettings(),
    getTranslations("CarFile"),
    listReservationsForStaff({ carId: car.id }),
    auth(),
  ]);
  const readOnly = outOfScope || car.status === "deactivated";
  const recordTab = (kind: CarRecordKind, icon: React.ReactNode, warnDays: number, warnKm?: number) => ({
    id: kind,
    label: tf(`${kind}.tab`),
    icon,
    content: (
      <CarRecordsTab carId={car.id} kind={kind} records={records.filter((r) => r.kind === kind)} currentMileage={car.mileage} warnDays={warnDays} warnKm={warnKm} readOnly={readOnly} />
    ),
  });
  const preset = query.new === "departure" || query.new === "return" ? { kind: query.new as "departure" | "return", reservationId: query.reservation } : null;
  const extraTabs = [
    recordTab("insurance", <ShieldCheck />, alertCfg.insuranceDays),
    recordTab("vignette", <Stamp />, alertCfg.vignetteDays),
    recordTab("oil_change", <Droplets />, alertCfg.oilDays, alertCfg.oilKm),
    recordTab("technical_inspection", <ClipboardList />, alertCfg.inspectionDays),
    {
      id: "inspections",
      label: tf("inspectionsTab"),
      icon: <ClipboardCheck />,
      content: <InspectionsTab carId={car.id} rows={inspections} reservations={inspectable} currentMileage={car.mileage} readOnly={readOnly} preset={preset} />,
    },
    {
      id: "finance",
      label: tf("financeTab"),
      icon: <Wallet />,
      content: (
        <div className="space-y-6">
          <FinancePanel data={finance} locale={locale} />
          <div>
            <h3 className="mb-3 text-[15px] font-bold text-ink">{tf("expense.tab")}</h3>
            <CarRecordsTab carId={car.id} kind="expense" records={records.filter((r) => r.kind === "expense")} currentMileage={car.mileage} warnDays={0} readOnly={readOnly} />
          </div>
        </div>
      ),
    },
    { id: "calendar", label: tf("calendarTab"), icon: <CalendarDays />, content: <CarCalendar carId={car.id} base={base} /> },
    {
      id: "reservations",
      label: tf("reservationsTab"),
      icon: <ClipboardList />,
      content: <ReservationsTable tableKey="car-reservations" rows={carReservations} base={base} prefs={null} userId={session?.user?.id ?? ""} isAdmin={base === "/admin"} />,
    },
  ];

  if (car.status !== "deactivated") {
    return (
      <>
        <Link href={`${base}/fleet`} className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
        {outOfScope && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger-soft px-5 py-3 text-sm font-medium text-ink">
            <Lock className="size-4 shrink-0 text-danger" />
            {t("outOfScopeBanner")}
          </div>
        )}
        {car.status === "maintenance" && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-saffron/50 bg-saffron/10 px-5 py-3 text-sm font-medium text-ink">
            {t("inRepairBanner")}
          </div>
        )}
        {header(
          <div className="flex flex-wrap gap-2">
            <RepairButton id={car.id} inRepair={car.status === "maintenance"} />
            <DeactivateCarButton id={car.id} name={name} />
          </div>,
        )}
        <CarForm
          extraTabs={extraTabs}
          initialTab={query.tab}
          stats={statsTab}
          history={historyTab}
          promotion={<CarPromotion carId={car.id} dailyPrice={car.dailyPrice} initial={{ promoPercent: car.promoPercent, promoStartsOn: car.promoStartsOn, promoEndsOn: car.promoEndsOn }} frozen={false} />}
          base={base}
          carId={car.id}
          agencies={await allAgencies()}
          managers={await managerOptions()}
          initialManagerIds={car.managers.map((x) => x.manager.id)}
          initialResponsibleIds={row?.responsibleIds ?? []}
          initialExtraAgencyIds={row?.extraAgencyIds ?? []}
          initial={{
            agencyId: car.agencyId,
            brand: car.brand,
            model: car.model,
            year: car.year,
            category: car.category,
            transmission: car.transmission,
            fuel: car.fuel,
            seats: car.seats,
            doors: car.doors,
            luggage: car.luggage,
            colorName: car.colorName,
            colorHex: car.colorHex,
            plateNumber: car.plateNumber,
            vin: car.vin ?? "",
            mileage: car.mileage,
            dailyPrice: car.dailyPrice,
            deposit: car.deposit,
            airConditioning: car.airConditioning,
            purchaseCity: car.purchaseCity ?? "",
            purchaseDate: car.purchaseDate ?? "",
            purchasePrice: car.purchasePrice ?? "",
            descriptions: Object.fromEntries(car.translations.map((tr) => [tr.locale, tr.description])),
          }}
          initialImages={car.images.map((i, n) => ({ publicId: i.publicId, url: i.url, width: i.width, height: i.height, view: (i.view === "other" && n === 0 ? "main" : i.view) as CarView }))}
        />
      </>
    );
  }

  // Voiture désactivée : lecture seule, aucune action de modification proposée.
  return (
    <>
      <Link href={`${base}/fleet`} className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
      {header()}
      <div className="mb-6 flex items-start gap-4 rounded-2xl border border-mist-2 bg-mist/50 px-5 py-4">
        <Lock className="mt-0.5 size-5 shrink-0 text-ink-2" />
        <div>
          <p className="font-bold text-ink">{t("frozenTitle")}</p>
          <p className="mt-1 text-sm text-ink-2">
            {t("frozenBody", { date: formatDateTime(car.deactivatedAt, locale), reason: e(`carDeactivation.${car.deactivationReason ?? "other"}`) })}
          </p>
          {car.deactivationNote && <p className="mt-1 text-sm text-ink-3">{car.deactivationNote}</p>}
          {car.deactivatedByName && <p className="mt-1 text-xs text-ink-3">{car.deactivatedByName}</p>}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Panel className="overflow-hidden">
          <div className="relative aspect-[16/10] bg-gradient-to-b from-chalk to-mist/60 grayscale-[.6]">
            {car.images[0] ? <Image src={car.images[0].url} alt={name} fill sizes="40vw" className="object-cover" /> : <CarArt category={car.category} color={car.colorHex} className="absolute inset-x-6 bottom-4 w-[calc(100%-3rem)]" />}
          </div>
        </Panel>
        <Panel className="p-6">
          <div className="mb-5 flex items-center gap-2">
            <Badge tone="neutral" dot>{t("statusDeactivated")}</Badge>
          </div>
          <DefinitionList
            items={[
              { label: t("category"), value: e(`category.${car.category}`) },
              { label: t("year"), value: car.year },
              { label: t("transmission"), value: e(`transmission.${car.transmission}`) },
              { label: t("fuel"), value: e(`fuel.${car.fuel}`) },
              { label: t("seats"), value: car.seats },
              { label: t("colorName"), value: car.colorName },
              { label: t("mileage"), value: `${car.mileage.toLocaleString(locale)} km` },
              { label: t("vin"), value: car.vin ?? "—" },
              { label: t("dailyPrice"), value: formatMoney(car.dailyPrice, locale) },
              { label: t("deposit"), value: formatMoney(car.deposit, locale) },
              { label: t("purchaseCity"), value: car.purchaseCity ?? "—" },
              { label: t("purchaseDate"), value: car.purchaseDate ? formatDate(car.purchaseDate, locale) : "—" },
              { label: t("purchasePrice"), value: car.purchasePrice != null ? formatMoney(car.purchasePrice, locale) : "—" },
              { label: t("agency"), value: `${car.agency.city}, ${car.agency.name}` },
              { label: t("assignedManagers"), value: car.managers.length ? car.managers.map((x) => `${x.manager.firstName} ${x.manager.lastName}`).join(", ") : t("allManagers") },
              { label: t("statusDeactivated"), value: formatDate(car.deactivatedAt, locale) },
            ]}
          />
          {car.translations.length > 0 && (
            <div className="mt-6 space-y-3 border-t border-mist pt-5">
              {car.translations.map((tr) => (
                <div key={tr.locale}>
                  <p className="text-xs font-semibold text-ink-3">{localeMeta[tr.locale as Locale].native}</p>
                  <p className="text-sm text-ink-2" dir={localeMeta[tr.locale as Locale].dir}>{tr.description}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <section className="mt-8 space-y-4">
        <h2 className="font-bold text-ink">{t("tabHistory")}</h2>
        {statsTab}
        {historyTab}
      </section>
    </>
  );
}
