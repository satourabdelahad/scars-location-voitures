"use client";

import { DropdownMenu } from "radix-ui";
import { Download, FileJson, FileSpreadsheet, FileText, FileType2, Presentation, FileCode2, FileDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { EXPORT_FORMATS, FORMAT_LABEL, type ExportFormat } from "@/lib/export";
import { cn } from "@/lib/utils";

const ICONS: Record<ExportFormat, typeof FileText> = {
  pdf: FileDown,
  csv: FileSpreadsheet,
  docx: FileType2,
  pptx: Presentation,
  json: FileJson,
  xml: FileCode2,
  txt: FileText,
};

/** Menu "Exporter" : PDF, CSV, DOC, PPT, JSON, XML, TXT. */
export function ExportMenu({
  onExport,
  trigger,
  label,
  size = "md",
  align = "end",
}: {
  onExport: (f: ExportFormat) => Promise<void> | void;
  trigger?: ReactNode;
  label?: string;
  size?: "sm" | "md" | "icon";
  align?: "start" | "end";
}) {
  const t = useTranslations("Table");
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function run(f: ExportFormat) {
    setBusy(f);
    try {
      await onExport(f);
      toast.success(t("exportDone", { format: FORMAT_LABEL[f] }));
    } catch (e) {
      console.error(e);
      toast.error(String((e as Error).message || e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={label ?? t("export")}
            title={label ?? t("export")}
            className={cn(
              "inline-flex items-center justify-center gap-2 border border-mist-2 bg-paper font-semibold text-ink transition-colors hover:border-ink-3 data-[state=open]:border-majorelle",
              size === "icon" ? "size-8 rounded-lg" : size === "sm" ? "h-8 rounded-lg px-2.5 text-[13px]" : "h-10 rounded-[10px] px-3.5 text-sm",
            )}
          >
            {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Download className="size-4" />}
            {size !== "icon" && (label ?? t("export"))}
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} className="z-50 min-w-52 rounded-2xl border border-mist bg-paper p-1.5 shadow-[0_24px_60px_-20px_rgba(20,26,46,.35)] data-[state=open]:animate-[pop-in_.16s_var(--ease-road)]">
          {EXPORT_FORMATS.map((f) => {
            const Icon = ICONS[f];
            return (
              <DropdownMenu.Item
                key={f}
                disabled={busy !== null}
                onSelect={() => void run(f)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-chalk data-[highlighted]:text-ink"
              >
                <Icon className="size-4 text-ink-3" />
                {t("exportAs", { format: FORMAT_LABEL[f] })}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
