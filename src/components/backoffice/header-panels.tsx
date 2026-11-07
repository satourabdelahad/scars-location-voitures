"use client";

import { DropdownMenu } from "radix-ui";
import { Bell, CalendarPlus, CarFront, CircleCheck, Droplets, Handshake, KeyRound, Repeat, Settings2, ShieldCheck, Stamp, TriangleAlert, UserPlus, UsersRound, Wrench, ClipboardList } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { intlLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { alerts, markNotificationsSeen, notifications, teamPresence, type AlertItem, type NotificationItem, type TeamMember } from "@/server/actions/header";

/** Recharge les données toutes les minutes, et au retour sur l'onglet. */
function usePolling<T>(load: () => Promise<T | null>, everyMs = 60_000) {
  const [data, setData] = useState<T | null>(null);
  const refresh = useCallback(() => {
    load().then((d) => d !== null && setData(d));
  }, [load]);
  useEffect(() => {
    refresh();
    const id = setInterval(() => document.visibilityState === "visible" && refresh(), everyMs);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh, everyMs]);
  return [data, refresh, setData] as const;
}

const trigger =
  "relative inline-grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-mist/70 hover:text-ink data-[state=open]:bg-mist data-[state=open]:text-ink [&_svg]:size-5";
const panel = "z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-mist bg-paper shadow-[0_20px_60px_-20px_rgba(20,26,46,.35)]";

function Count({ n, tone = "danger" }: { n: number; tone?: "danger" | "warning" }) {
  if (!n) return null;
  return (
    <span className={cn("absolute -end-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-chalk tabular", tone === "danger" ? "bg-danger" : "bg-saffron text-ink")}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function ago(iso: string, locale: string) {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(Math.round(s), "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** Équipe : administrateur et gestionnaires, point vert = connecté, gris = déconnecté. */
function TeamMenu({ base }: { base: string }) {
  const t = useTranslations("HeaderPanels");
  const locale = useLocale();
  const load = useCallback(async () => {
    const r = await teamPresence();
    return r.ok ? r.data! : null;
  }, []);
  const [team] = usePolling<TeamMember[]>(load);
  const online = team?.filter((m) => m.online).length ?? 0;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={trigger} aria-label={t("team")} title={t("team")}>
        <UsersRound />
        {online > 0 && <span className="absolute end-1.5 bottom-1.5 size-2.5 rounded-full bg-palm ring-2 ring-chalk" aria-hidden />}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className={panel}>
          <div className="flex items-center justify-between border-b border-mist px-4 py-3">
            <p className="text-sm font-bold text-ink">{t("team")}</p>
            <span className="text-xs text-ink-3">{t("onlineCount", { count: online, total: team?.length ?? 0 })}</span>
          </div>
          <div className="scroll-thin max-h-[60vh] overflow-y-auto p-1.5">
            {(team ?? []).map((m) => {
              const row = (
                <>
                  <span className="relative shrink-0">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt="" className="size-9 rounded-full object-cover" />
                    ) : (
                      <span className="grid size-9 place-items-center rounded-full bg-majorelle-soft text-xs font-bold text-majorelle">{m.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                    )}
                    <span className={cn("absolute -end-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-paper", m.online ? "bg-palm" : "bg-mist-2")} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{m.name}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {m.role === "admin" ? t("roleAdmin") : t("roleManager")} · {m.online ? t("online") : m.lastSeen ? t("lastSeen", { when: ago(m.lastSeen, locale) }) : t("offline")}
                    </span>
                  </span>
                </>
              );
              return base === "/admin" ? (
                <DropdownMenu.Item key={m.id} asChild>
                  <Link href={`${base}/managers/${m.id}`} className="flex items-center gap-3 rounded-xl px-2.5 py-2 outline-none data-[highlighted]:bg-chalk">{row}</Link>
                </DropdownMenu.Item>
              ) : (
                <div key={m.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2">{row}</div>
              );
            })}
            {team && team.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-3">{t("noTeam")}</p>}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const N_ICON: Record<NotificationItem["kind"], React.ReactNode> = {
  booking: <CalendarPlus />,
  rental: <KeyRound />,
  available: <CircleCheck />,
  extension: <Repeat />,
  manager: <UserPlus />,
  deal: <Handshake />,
  car: <CarFront />,
};

/** Notifications : événements récents, avec le nombre de non lus. */
function NotificationsMenu() {
  const t = useTranslations("HeaderPanels");
  const locale = useLocale();
  const load = useCallback(async () => {
    const r = await notifications();
    return r.ok ? r.data! : null;
  }, []);
  const [data, , setData] = usePolling(load);
  const unread = data?.unread ?? 0;
  return (
    <DropdownMenu.Root
      onOpenChange={(open) => {
        // À la fermeture, tout ce qui a été affiché devient lu.
        if (!open && unread > 0) {
          void markNotificationsSeen();
          setData((d) => (d ? { unread: 0, items: d.items.map((i) => ({ ...i, unread: false })) } : d));
        }
      }}
    >
      <DropdownMenu.Trigger className={trigger} aria-label={t("notificationsCount", { count: unread })} title={t("notifications")}>
        <Bell />
        <Count n={unread} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className={panel}>
          <div className="flex items-center justify-between border-b border-mist px-4 py-3">
            <p className="text-sm font-bold text-ink">{t("notifications")}</p>
            {unread > 0 && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">{t("unread", { count: unread })}</span>}
          </div>
          <div className="scroll-thin max-h-[65vh] overflow-y-auto p-1.5">
            {(data?.items ?? []).map((n) => (
              <DropdownMenu.Item key={n.key} asChild>
                <Link href={n.href} className={cn("flex items-start gap-3 rounded-xl px-2.5 py-2.5 outline-none data-[highlighted]:bg-chalk", n.unread && "bg-majorelle-soft/40")}>
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-mist text-ink-2 [&_svg]:size-4">{N_ICON[n.kind]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-snug text-ink">{t(`n.${n.kind}`, { who: n.who, what: n.what })}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">{ago(n.at, locale)}</span>
                  </span>
                  {n.unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-majorelle" aria-label={t("new")} />}
                </Link>
              </DropdownMenu.Item>
            ))}
            {data && data.items.length === 0 && <p className="px-3 py-8 text-center text-sm text-ink-3">{t("noNotifications")}</p>}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const A_ICON: Record<AlertItem["kind"], React.ReactNode> = {
  available: <CircleCheck className="text-palm" />,
  repair: <Wrench className="text-saffron-ink" />,
  insurance: <ShieldCheck className="text-danger" />,
  oil_change: <Droplets className="text-danger" />,
  vignette: <Stamp className="text-danger" />,
  technical_inspection: <ClipboardList className="text-danger" />,
};

/** Alertes : voitures disponibles, en réparation, et échéances (assurance, vidange, vignette, visite technique). */
function AlertsMenu({ base }: { base: string }) {
  const t = useTranslations("HeaderPanels");
  const locale = useLocale();
  const load = useCallback(async () => {
    const r = await alerts();
    return r.ok ? r.data! : null;
  }, []);
  const [data] = usePolling(load);
  const items = data?.items ?? [];
  const urgent = items.filter((a) => !["available", "repair"].includes(a.kind)).length;
  const detail = (a: AlertItem) => {
    if (a.kind === "available") return t("a.available");
    if (a.kind === "repair") return t("a.repair");
    const parts: string[] = [];
    if (a.days != null) parts.push(a.days < 0 ? t("a.expired", { count: -a.days }) : a.days === 0 ? t("a.today") : t("a.inDays", { count: a.days }));
    if (a.km != null) parts.push(a.km < 0 ? t("a.kmOver", { km: (-a.km).toLocaleString(locale) }) : t("a.kmLeft", { km: a.km.toLocaleString(locale) }));
    return `${t(`a.${a.kind}`)} · ${parts.join(" · ")}`;
  };
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={trigger} aria-label={t("alertsCount", { count: items.length })} title={t("alerts")}>
        <TriangleAlert />
        <Count n={items.length} tone={urgent ? "danger" : "warning"} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className={panel}>
          <div className="flex items-center justify-between border-b border-mist px-4 py-3">
            <p className="text-sm font-bold text-ink">{t("alerts")}</p>
            {base === "/admin" && (
              <DropdownMenu.Item asChild>
                <Link href="/admin/alerts" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-majorelle outline-none data-[highlighted]:bg-majorelle-soft">
                  <Settings2 className="size-3.5" />
                  {t("configure")}
                </Link>
              </DropdownMenu.Item>
            )}
          </div>
          <div className="scroll-thin max-h-[65vh] overflow-y-auto p-1.5">
            {items.map((a) => (
              <DropdownMenu.Item key={a.key} asChild>
                <Link href={a.href} className="flex items-start gap-3 rounded-xl px-2.5 py-2.5 outline-none data-[highlighted]:bg-chalk">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-mist [&_svg]:size-4">{A_ICON[a.kind]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{a.car} <span className="font-normal text-ink-3" dir="ltr">· {a.plate}</span></span>
                    <span className={cn("block text-xs", (a.days ?? 1) < 0 || (a.km ?? 1) < 0 ? "font-semibold text-danger" : "text-ink-3")}>{detail(a)}</span>
                  </span>
                </Link>
              </DropdownMenu.Item>
            ))}
            {data && items.length === 0 && <p className="px-3 py-8 text-center text-sm text-ink-3">{t("noAlerts")}</p>}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** En haut à droite, à gauche du compte : alertes, notifications, équipe. */
export function HeaderPanels({ base }: { base: "/admin" | "/manager" }) {
  return (
    <>
      <AlertsMenu base={base} />
      <NotificationsMenu />
      <TeamMenu base={base} />
    </>
  );
}
