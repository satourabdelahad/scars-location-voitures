import { CalendarClock, Handshake, History, IdCard } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/misc";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import { ManagerAvatar } from "./manager-avatar";
import { UnlockButton } from "@/features/security/unlock-button";
import type { SessionUser } from "@/server/guards";
import { managerRentalCounts, type ManagerDetail } from "@/server/queries/managers";
import { dealFormOptions, managerActivity, managerDeals, managerRentals } from "@/server/queries/manager-profile";
import { ManagerForm } from "./manager-form";
import { PasswordForm } from "@/features/profile/profile-form";
import { ManagerActions } from "./manager-actions";
import { ManagerCardExport } from "./managers-table";
import { RentalsTab } from "./rentals-tab";
import { DealsTab } from "./deals-tab";
import { HistoryTab } from "./history-tab";

export const PROFILE_TABS = ["infos", "rentals", "deals", "history"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export function parseTab(v: string | string[] | undefined): ProfileTab {
  return PROFILE_TABS.includes(v as ProfileTab) ? (v as ProfileTab) : "infos";
}

/**
 * Fiche gestionnaire en 4 onglets, partagée entre l'espace administrateur
 * (/admin/managers/[id]) et l'espace gestionnaire (/manager/profile).
 */
export async function ManagerProfile({
  manager: m,
  viewer,
  basePath,
  tab,
  edit,
  locale,
}: {
  manager: ManagerDetail;
  viewer: SessionUser;
  basePath: string;
  tab: ProfileTab;
  edit: boolean;
  locale: string;
}) {
  const isAdmin = viewer.role === "admin";
  const [t, c, e] = await Promise.all([getTranslations("Managers"), getTranslations("Common"), getTranslations("Enums")]);
  const name = `${m.firstName} ${m.lastName}`;
  const locked = m.user.loginLockedUntil && m.user.loginLockedUntil > new Date() ? m.user.loginLockedUntil : null;
  const reservationsBase = isAdmin ? "/admin/reservations" : "/manager/reservations";

  const tabs: { id: ProfileTab; label: string; Icon: typeof IdCard }[] = [
    { id: "infos", label: t("tabInfo"), Icon: IdCard },
    { id: "rentals", label: t("tabRentals"), Icon: CalendarClock },
    { id: "deals", label: t("tabDeals"), Icon: Handshake },
    { id: "history", label: t("tabHistory"), Icon: History },
  ];

  const formInitial = {
    civility: m.civility,
    lastName: m.lastName,
    firstName: m.firstName,
    email: m.user.email ?? "",
    phone: m.phone,
    whatsapp: m.whatsapp,
    city: m.city,
    birthDate: m.birthDate,
    maritalStatus: m.maritalStatus ?? ("" as const),
    workStartDate: m.workStartDate,
    contractType: m.contractType,
  };
  const readOnlyInfo = {
    lastLogin: m.user.lastLoginAt ? formatDateTime(m.user.lastLoginAt, locale) : c("never"),
    adminUpdatedAt: formatDateTime(m.adminUpdatedAt, locale),
  };

  let body: React.ReactNode;
  if (tab === "rentals") {
    body = <RentalsTab rows={await managerRentals(m.userId)} reservationsBase={reservationsBase} />;
  } else if (tab === "deals") {
    const [deals, options] = await Promise.all([managerDeals(m.id), dealFormOptions()]);
    body = <DealsTab scope={{ managerId: m.id }} deals={deals} options={options} />;
  } else if (tab === "history") {
    body = <HistoryTab rows={await managerActivity(m.userId, m.id)} />;
  } else if (!isAdmin) {
    // Le gestionnaire sur sa propre fiche : même formulaire que l'administrateur (consultation puis « Modifier »),
    // sauf la date de début et le type de contrat, réservés à l'administrateur.
    body = (
      <div className="space-y-4">
        <ManagerForm
          managerId={m.id}
          initialPhotoUrl={m.photoUrl}
          initialMode="view"
          canEdit={m.status === "active"}
          canOpenDocs
          lockedFields={["workStartDate", "contractType"]}
          initial={formInitial}
          existingDocs={m.documents.map((d) => d.kind)}
          readOnly={readOnlyInfo}
        />
        <PasswordForm hasPassword={m.user.hasPassword} />
      </div>
    );
  } else {
    body = (
      <ManagerForm
        key={edit ? "edit" : "view"}
        managerId={m.id}
        initialPhotoUrl={m.photoUrl}
        initialMode={edit && isAdmin && m.status === "active" ? "edit" : "view"}
        canEdit={isAdmin && m.status === "active"}
        canOpenDocs={isAdmin}
        statusActions={
          isAdmin ? <ManagerActions id={m.id} name={name} status={m.status} canResendInvite={!m.user.hasPassword && m.status === "active"} /> : undefined
        }
        initial={formInitial}
        existingDocs={m.documents.map((d) => d.kind)}
        readOnly={readOnlyInfo}
      />
    );
  }

  return (
    <>
      {isAdmin && <Link href="/admin/managers" className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>}
      <div className="mt-3 mb-6 flex flex-wrap items-center gap-4">
        <ManagerAvatar photoUrl={m.photoUrl} firstName={m.firstName} lastName={m.lastName} size="md" />
        <div className="min-w-[min(100%,14rem)] flex-1">
          <h1 className="display-md text-2xl text-ink sm:text-3xl">{name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={m.status === "active" ? "success" : "neutral"} dot>{m.status === "active" ? c("active") : c("deactivated")}</Badge>
            <Badge tone="info">{e(`contract.${m.contractType}`)}</Badge>
            {locked && <Badge tone="danger" dot>{t("locked")}</Badge>}
            <span className="text-sm text-ink-3">{m.city}</span>
          </div>
        </div>
        {isAdmin && <ManagerCardExport manager={await exportRow(m)} size="md" />}
      </div>

      {locked && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger-soft px-5 py-4">
          <p className="min-w-0 flex-1 text-sm font-semibold text-danger">{t("lockedBanner", { date: formatDateTime(locked, locale) })}</p>
          {isAdmin && <UnlockButton userId={m.userId} />}
        </div>
      )}
      {m.status === "deactivated" && (
        <div className="mb-6 rounded-2xl border border-mist-2 bg-mist/50 px-5 py-4">
          <p className="font-semibold text-ink">{t("deactivatedOn", { date: formatDate(m.deactivatedAt, locale) })}</p>
          <p className="mt-1 text-sm text-ink-2">{t("deactivationReason")} : {m.deactivationReason}</p>
        </div>
      )}

      <nav aria-label={t("title")} className="scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-mist">
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

async function exportRow(m: ManagerDetail) {
  const counts = await managerRentalCounts(m.userId);
  return {
    id: m.id,
    civility: m.civility,
    lastName: m.lastName,
    firstName: m.firstName,
    photoUrl: m.photoUrl,
    lockedUntil: m.user.loginLockedUntil?.toISOString() ?? null,
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
}

