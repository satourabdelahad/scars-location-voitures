"use client";

import { usePendingProgress } from "@/lib/use-pending-progress";
import { useTranslations } from "next-intl";
import { useTransition, type ComponentType } from "react";
import { FacebookIcon, GoogleIcon, InstagramIcon, TikTokIcon, XIcon } from "@/components/brand-icons";
import { socialLoginAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

const PROVIDERS: { id: "google" | "facebook" | "twitter" | "tiktok" | "instagram"; name: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: "google", name: "Google", Icon: GoogleIcon },
  { id: "facebook", name: "Facebook", Icon: FacebookIcon },
  { id: "twitter", name: "X", Icon: XIcon },
  { id: "tiktok", name: "TikTok", Icon: TikTokIcon },
  { id: "instagram", name: "Instagram", Icon: InstagramIcon },
];

export function SocialButtons({ enabled, callbackUrl }: { enabled: Record<string, boolean>; callbackUrl?: string }) {
  const t = useTranslations("Auth");
  const [pending, start] = useTransition();
  usePendingProgress(pending);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {PROVIDERS.map(({ id, name, Icon }, i) => {
        const on = enabled[id];
        return (
          <button
            key={id}
            type="button"
            disabled={!on || pending}
            title={on ? undefined : t("notConfigured", { provider: name })}
            onClick={() => start(() => socialLoginAction(id, callbackUrl))}
            className={cn(
              "flex h-12 items-center gap-3 rounded-xl border border-mist-2 bg-paper px-4 text-[15px] font-semibold text-ink transition-colors hover:border-ink-3 hover:bg-chalk disabled:cursor-not-allowed disabled:opacity-45",
              i === 0 && "sm:col-span-2",
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className="flex-1 text-start">{t("continueWith", { provider: name })}</span>
          </button>
        );
      })}
      <p className="mt-1 text-xs text-ink-3 sm:col-span-2">{t("instagramNote")}</p>
    </div>
  );
}
