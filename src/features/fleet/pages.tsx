import Image from "next/image";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Lock, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { tablePreferences } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { localeMeta, type Locale } from "@/i18n/config";
import { CarArt } from "@/components/car-art";
import { Button } from "@/components/ui/button";
import { Badge, DefinitionList, PageHeader, Panel } from "@/components/ui/misc";
import { allAgencies, getFleetCar, listFleet, managerOptions } from "@/server/queries/fleet";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { FleetTable } from "./fleet-table";
import { CarForm } from "./car-form";
import { DeactivateCarButton } from "./deactivate-car";
import { RepairButton } from "./repair-button";
import { CAR_STATES, carState, STATE_TONE } from "@/lib/car-state";

type Base = "/admin" | "/manager";

export async function FleetListPage({ base, userId }: { base: Base; userId: string }) {
  const t = await getTranslations("Fleet");
  const [rows, [prefs]] = await Promise.all([
    listFleet(),
    db.select().from(tablePreferences).where(and(eq(tablePreferences.userId, userId), eq(tablePreferences.tableKey, "fleet"))),
  ]);
  const stats = CAR_STATES.map((s) => ({ label: t(`state.${s}`), value: rows.filter((r) => carState(r) === s).length, tone: STATE_TONE[s] }));
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<Button asChild><Link href={`${base}/fleet/new`}><Plus />{t("new")}</Link></Button>}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Panel key={s.label} className="p-5">
            <p className="text-xs font-medium text-ink-3">{s.label}</p>
            <p className="mt-2 text-3xl font-extrabold text-ink tabular" style={{ fontStretch: "115%" }}>{s.value}</p>
          </Panel>
        ))}
      </div>
      <FleetTable rows={rows} base={base} prefs={prefs ? { visibleColumns: prefs.visibleColumns, pageSize: prefs.pageSize } : null} />
    </>
  );
}

export async function NewCarPage({ base }: { base: Base }) {
  const t = await getTranslations("Fleet");
  return (
    <>
      <Link href={`${base}/fleet`} className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
      <PageHeader title={t("createTitle")} />
      <CarForm base={base} agencies={await allAgencies()} managers={await managerOptions()} />
    </>
  );
}

export async function CarDetailPage({ base, id, locale }: { base: Base; id: string; locale: string }) {
  const car = await getFleetCar(id);
  if (!car) notFound();
  const [t, e, tc] = await Promise.all([getTranslations("Fleet"), getTranslations("Enums"), getTranslations("Common")]);
  const name = `${car.brand} ${car.model}`;

  if (car.status !== "deactivated") {
    return (
      <>
        <Link href={`${base}/fleet`} className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
        {car.status === "maintenance" && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-saffron/50 bg-saffron/10 px-5 py-3 text-sm font-medium text-ink">
            {t("inRepairBanner")}
          </div>
        )}
        <PageHeader
          title={t("editTitle", { car: name })}
          subtitle={<span dir="ltr" className="font-mono">{car.plateNumber}</span>}
          actions={
            <div className="flex flex-wrap gap-2">
              <RepairButton id={car.id} inRepair={car.status === "maintenance"} />
              <DeactivateCarButton id={car.id} name={name} />
            </div>
          }
        />
        <CarForm
          base={base}
          carId={car.id}
          agencies={await allAgencies()}
          managers={await managerOptions()}
          initialManagerIds={car.managers.map((x) => x.manager.id)}
          initial={{
            agencyId: car.agencyId,
            brand: car.brand,
            model: car.model,
            year: car.year,
            category: car.category,
            transmission: car.transmission,
            fuel: car.fuel,
            seats: car.seats,
            doors: car.doors,
            luggage: car.luggage,
            colorName: car.colorName,
            colorHex: car.colorHex,
            plateNumber: car.plateNumber,
            vin: car.vin ?? "",
            mileage: car.mileage,
            dailyPrice: car.dailyPrice,
            deposit: car.deposit,
            airConditioning: car.airConditioning,
            purchaseCity: car.purchaseCity ?? "",
            purchaseDate: car.purchaseDate ?? "",
            purchasePrice: car.purchasePrice ?? "",
            descriptions: Object.fromEntries(car.translations.map((tr) => [tr.locale, tr.description])),
          }}
          initialImages={car.images.map((i) => ({ publicId: i.publicId, url: i.url, width: i.width, height: i.height }))}
        />
      </>
    );
  }

  // Voiture désactivée : lecture seule, aucune action de modification proposée.
  return (
    <>
      <Link href={`${base}/fleet`} className="text-sm font-medium text-ink-3 hover:text-ink">← {t("title")}</Link>
      <PageHeader title={name} subtitle={<span dir="ltr" className="font-mono">{car.plateNumber}</span>} />
      <div className="mb-6 flex items-start gap-4 rounded-2xl border border-mist-2 bg-mist/50 px-5 py-4">
        <Lock className="mt-0.5 size-5 shrink-0 text-ink-2" />
        <div>
          <p className="font-bold text-ink">{t("frozenTitle")}</p>
          <p className="mt-1 text-sm text-ink-2">
            {t("frozenBody", { date: formatDateTime(car.deactivatedAt, locale), reason: e(`carDeactivation.${car.deactivationReason ?? "other"}`) })}
          </p>
          {car.deactivationNote && <p className="mt-1 text-sm text-ink-3">{car.deactivationNote}</p>}
          {car.deactivatedByName && <p className="mt-1 text-xs text-ink-3">{car.deactivatedByName}</p>}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Panel className="overflow-hidden">
          <div className="relative aspect-[16/10] bg-gradient-to-b from-chalk to-mist/60 grayscale-[.6]">
            {car.images[0] ? <Image src={car.images[0].url} alt={name} fill sizes="40vw" className="object-cover" /> : <CarArt category={car.category} color={car.colorHex} className="absolute inset-x-6 bottom-4 w-[calc(100%-3rem)]" />}
          </div>
        </Panel>
        <Panel className="p-6">
          <div className="mb-5 flex items-center gap-2">
            <Badge tone="neutral" dot>{t("statusDeactivated")}</Badge>
          </div>
          <DefinitionList
            items={[
              { label: t("category"), value: e(`category.${car.category}`) },
              { label: t("year"), value: car.year },
              { label: t("transmission"), value: e(`transmission.${car.transmission}`) },
              { label: t("fuel"), value: e(`fuel.${car.fuel}`) },
              { label: t("seats"), value: car.seats },
              { label: t("colorName"), value: car.colorName },
              { label: t("mileage"), value: `${car.mileage.toLocaleString(locale)} km` },
              { label: t("vin"), value: car.vin ?? "—" },
              { label: t("dailyPrice"), value: formatMoney(car.dailyPrice, locale) },
              { label: t("deposit"), value: formatMoney(car.deposit, locale) },
              { label: t("purchaseCity"), value: car.purchaseCity ?? "—" },
              { label: t("purchaseDate"), value: car.purchaseDate ? formatDate(car.purchaseDate, locale) : "—" },
              { label: t("purchasePrice"), value: car.purchasePrice != null ? formatMoney(car.purchasePrice, locale) : "—" },
              { label: t("agency"), value: `${car.agency.city}, ${car.agency.name}` },
              { label: t("assignedManagers"), value: car.managers.length ? car.managers.map((x) => `${x.manager.firstName} ${x.manager.lastName}`).join(", ") : t("allManagers") },
              { label: t("statusDeactivated"), value: formatDate(car.deactivatedAt, locale) },
            ]}
          />
          {car.translations.length > 0 && (
            <div className="mt-6 space-y-3 border-t border-mist pt-5">
              {car.translations.map((tr) => (
                <div key={tr.locale}>
                  <p className="text-xs font-semibold text-ink-3">{localeMeta[tr.locale as Locale].native}</p>
                  <p className="text-sm text-ink-2" dir={localeMeta[tr.locale as Locale].dir}>{tr.description}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
