import { eq, gt } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/server/guards";
import { getSecuritySettings } from "@/server/settings";
import { TwoFactorPanel } from "@/features/security/two-factor-panel";
import { LockedAccounts, SecuritySettingsForm } from "@/features/security/security-settings-form";

export default async function SecurityPage({ params }: PageProps<"/[locale]/admin/security">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await requireRole(["admin"], "/admin/security");
  const [[me], settings, locked, t] = await Promise.all([
    db.select({ enabledAt: users.totpEnabledAt, codes: users.totpRecoveryCodes }).from(users).where(eq(users.id, admin.id)).limit(1),
    getSecuritySettings(),
    db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, until: users.loginLockedUntil })
      .from(users)
      .where(gt(users.loginLockedUntil, new Date())),
    getTranslations("Security"),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid items-start gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <SecuritySettingsForm initial={settings} />
          <TwoFactorPanel enabledAt={me?.enabledAt?.toISOString() ?? null} codesLeft={me?.codes?.length ?? 0} locale={locale} />
        </div>
        <div className="space-y-4">
          <LockedAccounts rows={locked.map((l) => ({ ...l, until: l.until!.toISOString() }))} />
          <aside className="rounded-2xl border border-mist bg-paper p-6 text-sm text-ink-2">
            <h2 className="mb-2 font-bold text-ink">{t("rulesTitle")}</h2>
            <p>{t("ruleSocial")}</p>
          </aside>
        </div>
      </div>
    </>
  );
}
