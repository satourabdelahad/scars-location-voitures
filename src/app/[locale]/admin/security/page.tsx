import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { users } from "@/db/schema";
import { STAFF_SESSION_HOURS } from "@/auth";
import { requireRole } from "@/server/guards";
import { TwoFactorPanel } from "@/features/security/two-factor-panel";
import { LOCK_WINDOW_MIN } from "@/server/security";

export default async function SecurityPage({ params }: PageProps<"/[locale]/admin/security">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await requireRole(["admin"], "/admin/security");
  const [me] = await db
    .select({ enabledAt: users.totpEnabledAt, codes: users.totpRecoveryCodes })
    .from(users)
    .where(eq(users.id, admin.id))
    .limit(1);
  const t = await getTranslations("Security");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <TwoFactorPanel enabledAt={me?.enabledAt?.toISOString() ?? null} codesLeft={me?.codes?.length ?? 0} locale={locale} />
        <aside className="h-fit space-y-3 rounded-2xl border border-mist bg-paper p-6">
          <h2 className="font-bold text-ink">{t("rulesTitle")}</h2>
          <ul className="space-y-2.5 text-sm text-ink-2">
            <li>{t("ruleLock", { minutes: LOCK_WINDOW_MIN })}</li>
            <li>{t("ruleSession", { hours: STAFF_SESSION_HOURS })}</li>
            <li>{t("ruleSocial")}</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
