import { asc } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { extras } from "@/db/schema";
import { requireRole } from "@/server/guards";
import { getBookingSettings } from "@/server/app-settings";
import { ExtrasForm } from "@/features/administration/extras-form";

export default async function ExtrasPage({ params }: PageProps<"/[locale]/admin/extras">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"], "/admin/extras");
  const [t, tx, rows, booking] = await Promise.all([
    getTranslations("ExtrasAdmin"),
    getTranslations("Extras"),
    db.select().from(extras).orderBy(asc(extras.sortOrder), asc(extras.id)),
    getBookingSettings(),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ExtrasForm
        locale={locale}
        booking={booking}
        initial={rows.map((x) => ({ id: x.id, name: x.name ?? (tx.has(x.code as "gps") ? tx(x.code as "gps") : x.code), price: x.pricePerDay, pricing: x.pricing, isActive: x.isActive }))}
      />
    </>
  );
}
