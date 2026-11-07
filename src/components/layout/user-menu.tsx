"use client";

import { DropdownMenu } from "radix-ui";
import { CalendarCheck, CarFront, Handshake, History, LayoutDashboard, LogOut, Trophy, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/server/actions/auth";
import type { Role } from "@/db/schema";
import { cn } from "@/lib/utils";
import { startProgress } from "@/lib/progress";

export function UserMenu({ user, tone = "light" }: { user: { name?: string | null; email?: string | null; image?: string | null; role: Role }; tone?: "light" | "dark" }) {
  const t = useTranslations("Nav");
  const tb = useTranslations("Back");
  const home = user.role === "admin" ? "/admin" : user.role === "manager" ? "/manager" : "/account";
  const roleLabel = user.role === "admin" ? tb("roleAdmin") : user.role === "manager" ? tb("roleManager") : tb("roleClient");
  const display = user.name || user.email || "—";
  const [leaving, startLeaving] = useTransition();
  const item = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 outline-none data-[highlighted]:bg-chalk data-[highlighted]:text-ink";
  const staff = user.role !== "client";
  // Menu en haut à droite : chaque entrée ouvre l'onglet correspondant de sa propre fiche.
  const profile = user.role === "client" ? "/account/profile" : `${home}/profile`;
  const links = [
    { href: profile, label: t("profile"), Icon: UserRound },
    ...(staff
      ? [
          { href: `${profile}?tab=deals`, label: t("myDeals"), Icon: Handshake },
          { href: `${profile}?tab=cars`, label: t("myCars"), Icon: CarFront },
          { href: `${profile}?tab=rentals`, label: t("myAchievements"), Icon: Trophy },
          { href: `${profile}?tab=history`, label: t("history"), Icon: History },
        ]
      : [{ href: "/account", label: t("myReservations"), Icon: CalendarCheck }]),
  ];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-full ps-1 pe-3 text-sm font-semibold transition-colors",
          tone === "dark" ? "text-white hover:bg-white/10" : "text-ink hover:bg-mist",
        )}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-8 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-majorelle text-xs font-bold text-white">
            {display.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden min-w-0 text-start leading-tight sm:block">
          <span className="block max-w-40 truncate">{display}</span>
          <span className={cn("block text-[11px] font-medium", tone === "dark" ? "text-white/70" : "text-ink-3")}>{roleLabel}</span>
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-60 rounded-2xl border border-mist bg-paper p-1.5 shadow-[0_24px_60px_-20px_rgba(20,26,46,.35)] data-[state=open]:animate-[pop-in_.16s_var(--ease-road)]"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-bold text-ink">{display}</p>
            <p className="text-xs text-ink-3">{roleLabel}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-mist" />
          {links.map(({ href, label, Icon }) => (
            <DropdownMenu.Item key={href} asChild>
              <Link href={href} className={item}>
                <Icon className="size-4" />
                {label}
              </Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-mist" />
          <DropdownMenu.Item asChild>
            <Link href={home} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 outline-none data-[highlighted]:bg-chalk data-[highlighted]:text-ink">
              {user.role === "client" ? <CalendarCheck className="size-4" /> : <LayoutDashboard className="size-4" />}
              {user.role === "admin" ? t("adminSpace") : user.role === "manager" ? t("managerSpace") : t("clientSpace")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={leaving}
            onSelect={() => {
              // Barre de progression, déconnexion, puis retour à l'accueil public.
              startProgress();
              startLeaving(() => signOutAction());
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
          >
            <LogOut className="size-4" />
            {t("logout")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
