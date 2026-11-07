import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { DOC } from "./content";
import { DocumentationView } from "./documentation-view";

/** Page Documentation du back-office ; les sections réservées à l'administrateur sont masquées aux gestionnaires. */
export async function DocumentationPage({ isAdmin }: { isAdmin: boolean }) {
  const t = await getTranslations("Docs");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DocumentationView sections={DOC.filter((s) => isAdmin || !s.adminOnly)} />
    </>
  );
}
