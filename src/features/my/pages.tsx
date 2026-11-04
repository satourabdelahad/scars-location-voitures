import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import type { SessionUser } from "@/server/guards";
import { dealFormOptions, managerRentals, myAppointments, scheduledAppointments, staffOptions } from "@/server/queries/manager-profile";
import { allAgencies } from "@/server/queries/fleet";
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
