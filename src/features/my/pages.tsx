import { getTranslations } from "next-intl/server";
import type { SessionUser } from "@/server/guards";
import { dealFormOptions, myAppointments, scheduledAppointments, staffOptions } from "@/server/queries/manager-profile";
import { allAgencies } from "@/server/queries/fleet";
import { ScheduledAppointments } from "./scheduled";
import { Appointments } from "./appointments";

const resBase = (u: SessionUser) => (u.role === "admin" ? "/admin/reservations" : "/manager/reservations");

/** Rendez-vous planifiés, puis départs et retours : affichés sous les deals de sa propre fiche. */
export async function AppointmentsSection({ me }: { me: SessionUser }) {
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
    <div className="mt-8 space-y-6">
      <ScheduledAppointments rows={scheduled} options={{ agencies, cars: deal.cars, staff }} base={base} isAdmin={me.role === "admin"} meId={me.id} />
      <section>
        <h2 className="mb-3 font-bold text-ink">{t("movementsTitle")}</h2>
        <Appointments rows={rows} reservationsBase={resBase(me)} />
      </section>
    </div>
  );
}
