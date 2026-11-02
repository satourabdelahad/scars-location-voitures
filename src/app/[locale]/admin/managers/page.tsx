import { and, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/db";
import { tablePreferences } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/server/guards";
import { listManagersWithStats, managersDailyTrend } from "@/server/queries/managers";
import { ManagersCharts } from "./managers-charts";
import { ManagersTable } from "./managers-table";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/managers">) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "Managers" }))("title") };
}

export default async function ManagersPage({ params }: PageProps<"/[locale]/admin/managers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await requireRole(["admin"], "/admin/managers");
  const t = await getTranslations("Managers");
  const [rows, trend, [prefs]] = await Promise.all([
    listManagersWithStats(),
    managersDailyTrend(30),
    db
      .select()
      .from(tablePreferences)
      .where(and(eq(tablePreferences.userId, admin.id), eq(tablePreferences.tableKey, "managers"))),
  ]);

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button asChild>
            <Link href="/admin/managers/new"><Plus />{t("new")}</Link>
          </Button>
        }
      />
      <ManagersCharts managers={rows} trend={trend} />
      <div className="mt-6">
        <ManagersTable rows={rows} prefs={prefs ? { visibleColumns: prefs.visibleColumns, pageSize: prefs.pageSize } : null} />
      </div>
    </>
  );
}
