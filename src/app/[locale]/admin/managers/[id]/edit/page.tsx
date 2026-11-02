import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/server/guards";
import { getManager } from "@/server/queries/managers";
import { formatDateTime } from "@/lib/utils";
import { ManagerForm } from "../../manager-form";

export default async function EditManagerPage({ params }: PageProps<"/[locale]/admin/managers/[id]/edit">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"]);
  const m = await getManager(id);
  if (!m) notFound();
  const [t, c] = await Promise.all([getTranslations("Managers"), getTranslations("Common")]);
  return (
    <>
      <PageHeader title={t("editTitle", { name: `${m.firstName} ${m.lastName}` })} />
      <ManagerForm
        managerId={m.id}
        initial={{
          civility: m.civility,
          lastName: m.lastName,
          firstName: m.firstName,
          email: m.user.email ?? "",
          phone: m.phone,
          whatsapp: m.whatsapp,
          city: m.city,
          birthDate: m.birthDate,
          maritalStatus: m.maritalStatus ?? "",
          workStartDate: m.workStartDate,
          contractType: m.contractType,
        }}
        existingDocs={m.documents.map((d) => d.kind)}
        readOnly={{
          lastLogin: m.user.lastLoginAt ? formatDateTime(m.user.lastLoginAt, locale) : c("never"),
          adminUpdatedAt: formatDateTime(m.adminUpdatedAt, locale),
        }}
      />
    </>
  );
}
