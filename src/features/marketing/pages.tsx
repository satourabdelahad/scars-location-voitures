import { History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader, Panel } from "@/components/ui/misc";
import { listCampaigns, marketingAudience } from "@/server/queries/marketing";
import { CampaignsTable } from "./campaigns-table";
import { MarketingComposer } from "./marketing-composer";

export async function MarketingPage() {
  const [t, audience, campaigns] = await Promise.all([getTranslations("Marketing"), marketingAudience(), listCampaigns()]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <MarketingComposer audience={audience} />
      <h2 className="mt-10 mb-3 flex items-center gap-2 text-lg font-bold text-ink">
        <History className="size-5 text-ink-3" />
        {t("historyTitle")}
      </h2>
      {campaigns.length ? <CampaignsTable rows={campaigns} /> : <Panel><EmptyState icon={<History />} title={t("noCampaign")} body={t("noCampaignBody")} /></Panel>}
    </>
  );
}
