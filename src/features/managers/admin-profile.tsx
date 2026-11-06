import { eq } from "drizzle-orm";
import { Building2, CalendarClock, CarFront, Handshake, History, IdCard, KeyRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/misc";
import { db } from "@/db";
import { adminProfiles, managers, users } from "@/db/schema";
import { managerAgencyLinks } from "@/server/queries/agencies";
import { AgenciesTab } from "./agencies-tab";
import { cn, formatDateTime } from "@/lib/utils";
import { ManagerForm } from "./manager-form";
import type { SessionUser } from "@/server/guards";
import { activityLog, dealFormOptions, listDeals, managerRentals, staffSummary } from "@/server/queries/manager-profile";
import { listFleet } from "@/server/queries/fleet";
import { FleetTable } from "@/features/fleet/fleet-table";
import { DealsTab } from "./deals-tab";
import { RentalsChart } from "@/features/my/rentals-chart";
import { AppointmentsSection } from "@/features/my/pages";
import { PasswordForm } from "@/features/profile/profile-form";
import { ManagerAvatar } from "./manager-avatar";
import { StaffHeader } from "./staff-header";
import { RentalsTab } from "./rentals-tab";
import { HistoryTab } from "./history-tab";

export const ADMIN_PROFILE_TABS = ["infos", "agencies", "password", "cars", "rentals", "deals", "history"] as const;
export type AdminProfileTab = (typeof ADMIN_PROFILE_TABS)[number];
export const parseAdminTab = (v: unknown): AdminProfileTab => (ADMIN_PROFILE_TABS.includes(v as AdminProfileTab) ? (v as AdminProfileTab) : "infos");

/**
 * « Mon profil » de l'administrateur : même présentation que la fiche d'un gestionnaire
 * (en-tête, résumé, onglets Informations, Mot de passe, Réalisations, Historique).
 */
export async function AdminProfile({ me, tab, locale }: { me: SessionUser; tab: AdminProfileTab; locale: string }) {
  const [[u], [ap], summary, t, c, tb] = await Promise.all([
    db
      .select({ name: users.name, email: users.email, phone: users.phone, image: users.image, hash: users.passwordHash, status: users.status, lastLoginAt: users.lastLoginAt, updatedAt: users.updatedAt })
      .from(users)
      .where(eq(users.id, me.id))
      .limit(1),
    db.select().from(adminProfiles).where(eq(adminProfiles.userId, me.id)).limit(1),
    staffSummary(me.id, null),
    getTranslations("Managers"),
    getTranslations("Common"),
    getTranslations("Back"),
  ]);
  const [first0, ...rest0] = (u?.name ?? "").split(" ");
  const firstName = ap?.firstName ?? first0 ?? "";
  const lastName = ap?.lastName ?? rest0.join(" ");
  const name = `${firstName} ${lastName}`.trim() || u?.email || "—";
  const basePath = "/admin/profile";

  const tabs = [
    { id: "infos" as const, label: t("tabInfo"), Icon: IdCard },
    { id: "agencies" as const, label: t("tabAgencies"), Icon: Building2 },
    { id: "password" as const, label: t("tabPassword"), Icon: KeyRound },
    { id: "cars" as const, label: t("tabCars"), Icon: CarFront },
    { id: "rentals" as const, label: t("tabRentals"), Icon: CalendarClock },
    { id: "deals" as const, label: t("tabDeals"), Icon: Handshake },
    { id: "history" as const, label: t("tabHistory"), Icon: History },
  ];

  let body: React.ReactNode;
  if (tab === "password") body = <PasswordForm hasPassword={Boolean(u?.hash)} />;
  else if (tab === "agencies") {
    // L'administrateur appartient à toutes les agences.
    const [own] = await db.select({ id: managers.id }).from(managers).where(eq(managers.userId, me.id)).limit(1);
    body = own ? <AgenciesTab managerId={own.id} links={await managerAgencyLinks(own.id)} canEdit={false} isAdminTarget base="/admin" /> : null;
  }
  else if (tab === "cars") {
    // L'administrateur suit tout le parc : ici, les voitures qu'il a ajoutées.
    const mine = (await listFleet()).filter((car) => car.createdBy === me.id);
    body = (
      <div className="space-y-3">
        <p className="text-sm text-ink-3">{t("adminCarsHint", { count: mine.length })}</p>
        <FleetTable rows={mine} base="/admin" prefs={null} tableKey="admin-my-cars" />
      </div>
    );
  } else if (tab === "rentals") {
    const rentals = await managerRentals(me.id);
    body = (
      <div className="space-y-4">
        <RentalsChart rows={rentals} />
        <RentalsTab rows={rentals} reservationsBase="/admin/reservations" />
      </div>
    );
  } else if (tab === "deals") {
    const [deals, options] = await Promise.all([listDeals({ createdBy: me.id }), dealFormOptions()]);
    body = (
      <>
        <DealsTab scope={{}} deals={deals} options={options} />
        <AppointmentsSection me={me} />
      </>
    );
  }
  else if (tab === "history") body = <HistoryTab rows={await activityLog({ userId: me.id, managerId: null })} tableKey="admin-self-history" />;
  else
    // Même fiche que les gestionnaires (consultation puis « Modifier »), sans contrat ni pièces d'identité.
    body = (
      <ManagerForm
        variant="admin"
        managerId={me.id}
        initialPhotoUrl={u?.image ?? null}
        initialMode="view"
        canEdit
        initial={{
          civility: ap?.civility ?? "",
          lastName,
          firstName,
          email: u?.email ?? "",
          phone: u?.phone ?? "",
          whatsapp: ap?.whatsapp ?? "",
          city: ap?.city ?? "",
          birthDate: ap?.birthDate ?? "",
          maritalStatus: ap?.maritalStatus ?? "",
        }}
        readOnly={{ lastLogin: u?.lastLoginAt ? formatDateTime(u.lastLoginAt, locale) : c("never"), adminUpdatedAt: formatDateTime(u?.updatedAt ?? null, locale) }}
      />
    );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <ManagerAvatar photoUrl={u?.image ?? null} firstName={firstName || "?"} lastName={lastName} size="md" />
        <div className="min-w-[min(100%,14rem)] flex-1">
          <h1 className="display-md text-2xl text-ink sm:text-3xl">{name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={u?.status === "active" ? "success" : "neutral"} dot>{u?.status === "active" ? c("active") : c("deactivated")}</Badge>
            <Badge tone="dark">{tb("roleAdmin")}</Badge>
            {ap?.city && <span className="text-sm text-ink-3">{ap.city}</span>}
          </div>
        </div>
      </div>

      <StaffHeader summary={summary} email={u?.email ?? null} phone={u?.phone ?? null} whatsapp={ap?.whatsapp ?? null} locale={locale} isAdminProfile />

      <nav aria-label={t("tabInfo")} className="scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-mist">
        {tabs.map(({ id, label, Icon }) => (
          <Link
            key={id}
            href={id === "infos" ? basePath : `${basePath}?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
              tab === id ? "border-majorelle text-majorelle" : "border-transparent text-ink-3 hover:text-ink",
            )}
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
