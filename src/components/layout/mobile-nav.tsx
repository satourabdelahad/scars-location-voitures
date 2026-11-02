"use client";

import { Dialog } from "radix-ui";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "./theme-toggle";

export function MobileNav({ links, loggedIn, loginLabel, menuLabel }: { links: { href: string; label: string }[]; loggedIn: boolean; loginLabel: string; menuLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="grid size-10 place-items-center rounded-full text-ink hover:bg-mist md:hidden" aria-label={menuLabel}>
        <Menu className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-[fade-in_.18s_ease-out]" />
        <Dialog.Content className="fixed inset-y-0 end-0 z-50 flex w-[min(86vw,340px)] flex-col bg-paper p-5 shadow-2xl outline-none data-[state=open]:animate-[fade-in_.2s_ease-out]">
          <div className="mb-8 flex items-center justify-between">
            <Logo />
            <Dialog.Close className="grid size-10 place-items-center rounded-full hover:bg-mist" aria-label="×">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Title className="sr-only">{menuLabel}</Dialog.Title>
          <Dialog.Description className="sr-only">{menuLabel}</Dialog.Description>
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="display-md rounded-xl px-3 py-3 text-2xl text-ink hover:bg-chalk">
                {l.label}
              </Link>
            ))}
            {!loggedIn && (
              <Link href="/login" onClick={() => setOpen(false)} className="mt-4 rounded-xl bg-majorelle px-4 py-3 text-center font-semibold text-white">
                {loginLabel}
              </Link>
            )}
          </nav>
          <div className="mt-auto">
            <ThemeToggle />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
