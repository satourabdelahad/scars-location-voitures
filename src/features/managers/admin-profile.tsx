import { eq } from "drizzle-orm";
import { CalendarClock, History, IdCard, KeyRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/misc";
import { db } from "@/db";
import { users } from "@/db/schema";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/server/guards";
import { activityLog, managerRentals, staffSummary } from "@/server/queries/manager-profile";
import { PasswordForm, ProfileForm } from "@/features/profile/profile-form";
import { ManagerAvatar } from "./manager-avatar";
import { StaffHeader } from "./staff-header";
import { RentalsTab } from "./rentals-tab";
import { HistoryTab } from "./history-tab";

export const ADMIN_PROFILE_TABS = ["infos", "password", "rentals", "history"] as const;
export type AdminProfileTab = (typeof ADMIN_PROFILE_TABS)[number];
export const parseAdminTab = (v: unknown): AdminProfileTab => (ADMIN_PROFILE_TABS.includes(v as AdminProfileTab) ? (v as AdminProfileTab) : "infos");

/**
 * « Mon profil » de l'administrateur : même présentation que la fiche d'un gestionnaire
 * (en-tête, résumé, onglets Informations, Mot de passe, Réalisations, Historique).
 */
export async function AdminProfile({ me, tab, locale }: { me: SessionUser; tab: AdminProfileTab; locale: string }) {
  const [[u], summary, t, c, tb] = await Promise.all([
    db
      .select({ name: users.name, email: users.email, phone: users.phone, image: users.image, hash: users.passwordHash, status: users.status })
      .from(users)
      .where(eq(users.id, me.id))
      .limit(1),
    staffSummary(me.id, null),
    getTranslations("Managers"),
    getTranslations("Common"),
    getTranslations("Back"),
  ]);
  const name = u?.name ?? u?.email ?? "—";
  const [first, ...rest] = name.split(" ");
  const basePath = "/admin/profile";

  const tabs = [
    { id: "infos" as const, label: t("tabInfo"), Icon: IdCard },
    { id: "password" as const, label: t("tabPassword"), Icon: KeyRound },
    { id: "rentals" as const, label: t("tabRentals"), Icon: CalendarClock },
    { id: "history" as const, label: t("tabHistory"), Icon: History },
  ];

  let body: React.ReactNode;
  if (tab === "password") body = <PasswordForm hasPassword={Boolean(u?.hash)} />;
  else if (tab === "rentals") body = <RentalsTab rows={await managerRentals(me.id)} reservationsBase="/admin/reservations" />;
  else if (tab === "history") body = <HistoryTab rows={await activityLog({ userId: me.id, managerId: null })} tableKey="admin-self-history" />;
  else
    body = (
      <ProfileForm
        role="admin"
        displayName={name}
        photoUrl={u?.image ?? null}
        hasPassword={Boolean(u?.hash)}
        withPassword={false}
        initial={{ name: u?.name ?? "", email: u?.email ?? "", phone: u?.phone ?? "" }}
      />
    );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <ManagerAvatar photoUrl={u?.image ?? null} firstName={first || "?"} lastName={rest.join(" ")} size="md" />
        <div className="min-w-[min(100%,14rem)] flex-1">
          <h1 className="display-md text-2xl text-ink sm:text-3xl">{name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={u?.status === "active" ? "success" : "neutral"} dot>{u?.status === "active" ? c("active") : c("deactivated")}</Badge>
            <Badge tone="dark">{tb("roleAdmin")}</Badge>
          </div>
        </div>
      </div>

      <StaffHeader summary={summary} email={u?.email ?? null} phone={u?.phone ?? null} whatsapp={null} locale={locale} isAdminProfile />

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
