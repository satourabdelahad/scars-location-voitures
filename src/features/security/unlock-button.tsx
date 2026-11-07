"use client";

import { LockOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { unlockUser } from "@/server/actions/security-settings";

/** Débloque un compte bloqué après trop d'échecs de connexion (administrateur). */
export function UnlockButton({ userId }: { userId: string }) {
  const t = useTranslations("Security");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await unlockUser(userId);
          if (r.ok) {
            toast.success(t("unlocked"));
            router.refresh();
          } else toast.error(te(r.error as "unknown"));
        })
      }
    >
      <LockOpen />
      {t("unlock")}
    </Button>
  );
}
