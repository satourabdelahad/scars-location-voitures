import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { clientProfiles, users } from "@/db/schema";
import type { SessionUser } from "@/server/guards";
import { ProfileForm } from "./profile-form";

/** "Mon profil" de l'administrateur et des clients. */
export async function SelfProfilePage({ me, welcome = false }: { me: SessionUser; welcome?: boolean }) {
  const [[u], [cp], t] = await Promise.all([
    db.select({ name: users.name, email: users.email, phone: users.phone, image: users.image, hash: users.passwordHash }).from(users).where(eq(users.id, me.id)).limit(1),
    me.role === "client" ? db.select().from(clientProfiles).where(eq(clientProfiles.userId, me.id)).limit(1) : Promise.resolve([]),
    getTranslations("Profile"),
  ]);
  const [first, ...rest] = (u?.name ?? "").split(" ");
  return (
    <>
      <PageHeader title={t("title")} subtitle={u?.email ?? undefined} />
      <ProfileForm
        role={me.role}
        displayName={u?.name ?? u?.email ?? "?"}
        photoUrl={u?.image ?? null}
        hasPassword={Boolean(u?.hash)}
        welcome={welcome}
        initial={{
          name: u?.name ?? "",
          email: u?.email ?? "",
          phone: u?.phone ?? "",
          civility: cp?.civility ?? "",
          firstName: cp?.firstName ?? first ?? "",
          lastName: cp?.lastName ?? rest.join(" "),
          whatsapp: cp?.whatsapp ?? "",
          city: cp?.city ?? "",
          birthDate: cp?.birthDate ?? "",
          licenseNumber: cp?.licenseNumber ?? "",
        }}
      />
    </>
  );
}
