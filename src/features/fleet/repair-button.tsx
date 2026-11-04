"use client";

import { CircleCheck, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { setCarMaintenance } from "@/server/actions/fleet";

/** Mettre une voiture en réparation (retirée de la réservation en ligne) ou la remettre en service. */
export function RepairButton({ id, inRepair }: { id: string; inRepair: boolean }) {
  const t = useTranslations("Fleet");
  const te = useTranslations("Errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await setCarMaintenance(id, !inRepair);
          if (r.ok) {
            toast.success(inRepair ? t("repairEnded") : t("repairStarted"));
            router.refresh();
          } else toast.error(te(r.error as "unknown"));
        })
      }
    >
      {inRepair ? <CircleCheck /> : <Wrench />}
      {inRepair ? t("endRepair") : t("startRepair")}
    </Button>
  );
}
