import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/** Ancienne URL de modification : la fiche s'ouvre désormais directement en mode modification. */
export default async function EditManagerRedirect({ params }: PageProps<"/[locale]/admin/managers/[id]/edit">) {
  const { id } = await params;
  return redirect({ href: `/admin/managers/${id}?edit=1`, locale: await getLocale() });
}
