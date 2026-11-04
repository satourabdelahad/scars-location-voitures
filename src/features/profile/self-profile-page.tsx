import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { SessionUser } from "@/server/guards";
import { ProfileForm } from "./profile-form";

/** "Mon profil" de l'administrateur et des clients. */
export async function SelfProfilePage({ me }: { me: SessionUser }) {
  const [[u], t] = await Promise.all([
    db.select({ name: users.name, email: users.email, phone: users.phone, image: users.image, hash: users.passwordHash }).from(users).where(eq(users.id, me.id)).limit(1),
    getTranslations("Profile"),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={u?.email ?? undefined} />
      <ProfileForm
        role={me.role}
        displayName={u?.name ?? u?.email ?? "?"}
        photoUrl={u?.image ?? null}
        hasPassword={Boolean(u?.hash)}
        initial={{ name: u?.name ?? "", email: u?.email ?? "", phone: u?.phone ?? "" }}
      />
    </>
  );
}
