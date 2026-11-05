import { redirect } from "@/i18n/navigation";

/** Ancienne page du menu : c'est maintenant l'onglet de sa propre fiche. */
export default async function Page({ params }: PageProps<"/[locale]/manager/my-cars">) {
  const { locale } = await params;
  redirect({ href: "/manager/profile?tab=cars", locale });
}
