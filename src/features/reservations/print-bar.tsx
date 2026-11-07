"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Barre au-dessus du contrat : retour et impression / enregistrement en PDF (masquée à l'impression). */
export function PrintBar({ title, back }: { title: string; back: string }) {
  const t = useTranslations("Contract");
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[794px] flex-wrap items-center justify-between gap-3 px-4 sm:px-0">
      <Link href={back} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {title}
      </Link>
      <Button onClick={() => window.print()}>
        <Printer />
        {t("print")}
      </Button>
    </div>
  );
}
