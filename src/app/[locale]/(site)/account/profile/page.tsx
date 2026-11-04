import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/guards";
import { SelfProfilePage } from "@/features/profile/self-profile-page";

export default async function ClientProfilePage({ params }: PageProps<"/[locale]/account/profile">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole(["client"], "/account/profile");
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <SelfProfilePage me={me} />
    </div>
  );
}
