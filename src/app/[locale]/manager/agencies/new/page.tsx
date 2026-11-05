import { redirect } from "@/i18n/navigation";

/** Seul l'administrateur crée les agences : un gestionnaire revient à la liste. */
export default async function Page({ params }: PageProps<"/[locale]/manager/agencies/new">) {
  const { locale } = await params;
  redirect({ href: "/manager/agencies", locale });
}
