import { and, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/db";
import { tablePreferences } from "@/db/schema";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/server/guards";
import { listManagersWithStats } from "@/server/queries/managers";
import { ManagersTable } from "@/features/managers/managers-table";

/** Gestionnaires : consultation seule pour un gestionnaire (l'administrateur les gère). */
export default async function Page({ params }: PageProps<"/[locale]/manager/managers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole(["manager"], "/manager/managers");
  const [t, rows, [prefs]] = await Promise.all([
    getTranslations("Managers"),
    listManagersWithStats(),
    db.select().from(tablePreferences).where(and(eq(tablePreferences.userId, me.id), eq(tablePreferences.tableKey, "managers"))),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("readOnlySubtitle")} />
      <ManagersTable rows={rows} base="/manager" readOnly prefs={prefs ? { visibleColumns: prefs.visibleColumns, pageSize: prefs.pageSize } : null} />
    </>
  );
}
