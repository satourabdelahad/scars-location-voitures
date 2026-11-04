import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import type { SessionUser } from "@/server/guards";
import { managerRentals, myAppointments } from "@/server/queries/manager-profile";
import { RentalsTab } from "@/features/managers/rentals-tab";
import { Appointments } from "./appointments";
import { RentalsChart } from "./rentals-chart";

const resBase = (u: SessionUser) => (u.role === "admin" ? "/admin/reservations" : "/manager/reservations");

/** "Mes rendez-vous" (menu en haut à droite). */
export async function AppointmentsPage({ me }: { me: SessionUser }) {
  const [rows, t] = await Promise.all([myAppointments(me), getTranslations("My")]);
  return (
    <>
      <PageHeader title={t("appointmentsTitle")} subtitle={me.role === "admin" ? t("appointmentsAdmin") : t("appointmentsManager")} />
      <Appointments rows={rows} reservationsBase={resBase(me)} />
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
