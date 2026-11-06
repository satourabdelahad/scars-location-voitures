"use client";

import { Building2, CalendarRange, Megaphone, CarFront, CircleUserRound, Contact, LayoutGrid, Mails, Menu, ShieldCheck, UsersRound } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ICONS = { dashboard: LayoutGrid, managers: UsersRound, fleet: CarFront, reservations: CalendarRange, profile: CircleUserRound, security: ShieldCheck, administration: Mails, clients: Contact, agencies: Building2, marketing: Megaphone };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };

export function SideNav({ items, mobile }: { items: NavItem[]; mobile?: boolean }) {
  const pathname = usePathname();
  const isActive = (i: NavItem) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`));

  if (mobile) {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="grid size-10 place-items-center rounded-lg text-ink hover:bg-mist lg:hidden" aria-label="Menu">
          <Menu className="size-5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={8} className="z-50 min-w-56 rounded-2xl border border-mist bg-paper p-1.5 shadow-xl">
            {items.map((i) => {
              const Icon = ICONS[i.icon];
              return (
                <DropdownMenu.Item key={i.href} asChild>
                  <Link href={i.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-chalk", isActive(i) ? "font-semibold text-majorelle" : "text-ink-2")}>
                    <Icon className="size-4" />
                    {i.label}
                  </Link>
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  return (
    <nav className="mt-8 flex flex-col gap-0.5" aria-label="Navigation">
      {items.map((i) => {
        const Icon = ICONS[i.icon];
        const active = isActive(i);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-majorelle-soft text-majorelle" : "text-ink-2 hover:bg-chalk hover:text-ink",
            )}
          >
            {active && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-majorelle" aria-hidden />}
            <Icon className="size-[18px]" />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
