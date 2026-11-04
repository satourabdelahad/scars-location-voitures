import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import type { SessionUser } from "@/server/guards";
import { activityLog, dealFormOptions, managerIdForUser, managerRentals, myAppointments, scheduledAppointments, staffOptions } from "@/server/queries/manager-profile";
import { allAgencies, listFleet } from "@/server/queries/fleet";
import { HistoryTab } from "@/features/managers/history-tab";
import { FleetTable } from "@/features/fleet/fleet-table";
import { ScheduledAppointments } from "./scheduled";
import { RentalsTab } from "@/features/managers/rentals-tab";
import { Appointments } from "./appointments";
import { RentalsChart } from "./rentals-chart";

const resBase = (u: SessionUser) => (u.role === "admin" ? "/admin/reservations" : "/manager/reservations");

/** "Mes rendez-vous" (menu en haut à droite) : rendez-vous planifiés, puis départs et retours. */
export async function AppointmentsPage({ me }: { me: SessionUser }) {
  const [rows, scheduled, agencies, deal, staff, t] = await Promise.all([
    myAppointments(me),
    scheduledAppointments(me),
    allAgencies(),
    dealFormOptions(),
    me.role === "admin" ? staffOptions() : Promise.resolve([]),
    getTranslations("My"),
  ]);
  const base = me.role === "admin" ? "/admin" : "/manager";
  return (
    <>
      <PageHeader title={t("appointmentsTitle")} subtitle={me.role === "admin" ? t("appointmentsAdmin") : t("appointmentsManager")} />
      <div className="space-y-6">
        <ScheduledAppointments rows={scheduled} options={{ agencies, cars: deal.cars, staff }} base={base} isAdmin={me.role === "admin"} meId={me.id} />
        <section>
          <h2 className="mb-3 font-bold text-ink">{t("movementsTitle")}</h2>
          <Appointments rows={rows} reservationsBase={resBase(me)} />
        </section>
      </div>
    </>
  );
}

/** "Mes réalisations" : statistiques et toutes les locations réalisées (toute l'équipe pour l'administrateur). */
export async function AchievementsPage({ me }: { me: SessionUser }) {
  const [rows, t] = await Promise.all([managerRentals(me.role === "admin" ? null : me.id), getTranslations("My")]);
  return (
    <>
      <PageHeader title={t("achievementsTitle")} subtitle={me.role === "admin" ? t("achievementsAdmin") : t("achievementsManager")} />
      <div className="space-y-4">
        <RentalsChart rows={rows} />
        <RentalsTab rows={rows} reservationsBase={resBase(me)} showHandler={me.role === "admin"} />
      </div>
    </>
  );
}

/** "Historique" : l'activité du gestionnaire connecté, ou de toute l'équipe pour l'administrateur. */
export async function HistoryPage({ me }: { me: SessionUser }) {
  const isAdmin = me.role === "admin";
  const [rows, t] = await Promise.all([
    isAdmin ? activityLog(null) : managerIdForUser(me.id).then((managerId) => activityLog({ userId: me.id, managerId })),
    getTranslations("My"),
  ]);
  return (
    <>
      <PageHeader title={t("historyTitle")} subtitle={isAdmin ? t("historyAdmin") : t("historyManager")} />
      <HistoryTab rows={rows} global={isAdmin} tableKey="my-history" />
    </>
  );
}

/**
 * "Mes voitures" : pour un gestionnaire, les voitures qui lui sont affectées puis celles partagées
 * par tous (sans gestionnaire) ; pour l'administrateur, les voitures qu'il a ajoutées.
 */
export async function MyCarsPage({ me }: { me: SessionUser }) {
  const base = me.role === "admin" ? "/admin" : "/manager";
  const [fleet, t] = await Promise.all([listFleet(), getTranslations("My")]);
  if (me.role === "admin") {
    const mine = fleet.filter((c) => c.createdBy === me.id);
    return (
      <>
        <PageHeader title={t("carsTitle")} subtitle={t("carsAdmin", { count: mine.length })} />
        <FleetTable rows={mine} base={base} prefs={null} tableKey="my-cars" />
      </>
    );
  }
  const managerId = await managerIdForUser(me.id);
  const assigned = fleet.filter((c) => managerId && c.managerIds.includes(managerId));
  const shared = fleet.filter((c) => c.managerIds.length === 0 && c.status !== "deactivated");
  return (
    <>
      <PageHeader title={t("carsTitle")} subtitle={t("carsManager")} />
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 font-bold text-ink">{t("carsAssigned", { count: assigned.length })}</h2>
          <FleetTable rows={assigned} base={base} prefs={null} tableKey="my-cars" />
        </section>
        <section>
          <h2 className="mb-1 font-bold text-ink">{t("carsShared", { count: shared.length })}</h2>
          <p className="mb-3 text-sm text-ink-3">{t("carsSharedHint")}</p>
          <FleetTable rows={shared} base={base} prefs={null} tableKey="my-cars-shared" />
        </section>
      </div>
    </>
  );
}
