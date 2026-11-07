import { redirect } from "next/navigation";

/** L'ancien « Mon profil » client est l'onglet Informations de son espace. */
export default async function ClientProfilePage({ params, searchParams }: PageProps<"/[locale]/account/profile">) {
  const { locale } = await params;
  const sp = await searchParams;
  redirect(`/${locale}/account?tab=infos${sp.welcome === "1" ? "&welcome=1" : ""}`);
}
