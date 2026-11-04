import { CalendarClock, Handshake, IdCard, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Badge, PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { cn, formatDate, initials } from "@/lib/utils";
import { clientReservations, getClient, listClients } from "@/server/queries/clients";
import { dealFormOptions, listDeals } from "@/server/queries/manager-profile";
import { RentalsTab } from "@/features/managers/rentals-tab";
import { DealsTab } from "@/features/managers/deals-tab";
import { ClientForm } from "./client-form";
import { ClientStatusButton } from "./client-status";
import { ClientsTable, segmentTone } from "./clients-table";

type Base = "/admin" | "/manager";
const TABS = ["infos", "rentals", "deals"] as const;
type Tab = (typeof TABS)[number];
export const parseClientTab = (v: unknown): Tab => (TABS.includes(v as Tab) ? (v as Tab) : "infos");

export async function ClientsListPage({ base }: { base: Base }) {
  const [rows, t] = await Promise.all([listClients(), getTranslations("Clients")]);
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<Button asChild><Link href={`${base}/clients/new`}><Plus />{t("new")}</Link></Button>}
      />
      <ClientsTable rows={rows} base={base} />
    </>
  );
}

export async function NewClientPage({ base }: { base: Base }) {
  const t = await getTranslations("Clients");
  return (
    <>
      <Link href={`${base}/clients`} className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
      <div className="mt-3"><PageHeader title={t("createTitle")} /></div>
      <ClientForm base={base} />
    </>
  );
}

/** Fiche client : Informations, Locations, Négociations / demandes. */
export async function ClientProfilePage({ base, id, tab, locale }: { base: Base; id: string; tab: Tab; locale: string }) {
  const client = await getClient(id);
  if (!client) notFound();
  const [t, c, rows, all] = await Promise.all([getTranslations("Clients"), getTranslations("Common"), clientReservations(id), listClients()]);
  const name = `${client.firstName} ${client.lastName}`.trim() || client.email || "—";
  const segment = all.find((r) => r.id === id)?.segment ?? "never";
  const path = `${base}/clients/${id}`;

  let body: React.ReactNode;
  if (tab === "rentals") {
    body = <RentalsTab rows={rows} reservationsBase={`${base}/reservations`} showHandler />;
  } else if (tab === "deals") {
    const [deals, options] = await Promise.all([listDeals({ clientId: id }), dealFormOptions()]);
    body = (
      <DealsTab
        scope={{ clientId: id }}
        deals={deals}
        options={options}
        showManager
        prefill={{ prospectName: name, phone: client.phone ?? "", email: client.email ?? "", city: client.city ?? "", source: "phone" }}
      />
    );
  } else {
    body = (
      <ClientForm
        base={base}
        clientId={id}
        statusActions={<ClientStatusButton id={id} name={name} status={client.status} />}
        initial={{
          civility: client.civility ?? "",
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email ?? "",
          phone: client.phone ?? "",
          whatsapp: client.whatsapp ?? "",
          city: client.city ?? "",
          birthDate: client.birthDate ?? "",
          licenseNumber: client.licenseNumber ?? "",
          preferredLocale: client.preferredLocale ?? "fr",
          notes: client.notes ?? "",
        }}
      />
    );
  }

  const tabs = [
    { id: "infos" as const, label: t("tabInfo"), Icon: IdCard },
    { id: "rentals" as const, label: t("tabRentals", { count: rows.length }), Icon: CalendarClock },
    { id: "deals" as const, label: t("tabDeals"), Icon: Handshake },
  ];

  return (
    <>
      <Link href={`${base}/clients`} className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
      <div className="mt-3 mb-6 flex flex-wrap items-center gap-4">
        {client.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={client.image} alt="" className="size-14 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid size-14 place-items-center rounded-full bg-ink text-lg font-bold text-chalk" style={{ fontStretch: "120%" }}>{initials(client.firstName || "?", client.lastName || "")}</span>
        )}
        <div className="min-w-[min(100%,14rem)] flex-1">
          <h1 className="display-md text-2xl text-ink sm:text-3xl">{name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={client.status === "active" ? "success" : "neutral"} dot>{client.status === "active" ? c("active") : c("deactivated")}</Badge>
            <Badge tone={segmentTone[segment]}>{t(`seg.${segment}`)}</Badge>
            <span className="text-sm text-ink-3">{t("since", { date: formatDate(client.createdAt, locale) })}</span>
          </div>
        </div>
      </div>

      {client.status === "deactivated" && client.deactivationReason && (
        <div className="mb-6 rounded-2xl border border-mist-2 bg-mist/50 px-5 py-4 text-sm text-ink-2">
          <span className="font-semibold text-ink">{t("deactivationReason")} :</span> {client.deactivationReason}
        </div>
      )}

      <nav aria-label={t("title")} className="scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-mist">
        {tabs.map(({ id: tid, label, Icon }) => (
          <Link
            key={tid}
            href={tid === "infos" ? path : `${path}?tab=${tid}`}
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
