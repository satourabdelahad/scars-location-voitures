"use client";

import { DropdownMenu } from "radix-ui";
import { CalendarCheck, LayoutDashboard, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/server/actions/auth";
import type { Role } from "@/db/schema";
import { cn } from "@/lib/utils";

export function UserMenu({ user, tone = "light" }: { user: { name?: string | null; email?: string | null; image?: string | null; role: Role }; tone?: "light" | "dark" }) {
  const t = useTranslations("Nav");
  const tb = useTranslations("Back");
  const home = user.role === "admin" ? "/admin" : user.role === "manager" ? "/manager" : "/account";
  const roleLabel = user.role === "admin" ? tb("roleAdmin") : user.role === "manager" ? tb("roleManager") : tb("roleClient");
  const display = user.name || user.email || "—";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full ps-1 pe-3 text-sm font-semibold transition-colors",
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
        <span className="hidden max-w-32 truncate sm:inline">{display}</span>
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
          <DropdownMenu.Item asChild>
            <Link href={home} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 outline-none data-[highlighted]:bg-chalk data-[highlighted]:text-ink">
              {user.role === "client" ? <CalendarCheck className="size-4" /> : <LayoutDashboard className="size-4" />}
              {user.role === "admin" ? t("adminSpace") : user.role === "manager" ? t("managerSpace") : t("clientSpace")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <form action={signOutAction}>
              <button type="submit" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger outline-none hover:bg-danger-soft">
                <LogOut className="size-4" />
                {t("logout")}
              </button>
            </form>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
