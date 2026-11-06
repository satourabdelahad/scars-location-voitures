"use client";

/* eslint-disable @next/next/no-img-element */
import { BarChart3, Building2, Camera, Check, FileText, History, ImagePlus, Info, Percent, Star, Tag, Trash2, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { CarArt } from "@/components/car-art";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { CityCombobox, SuggestCombobox } from "@/components/ui/city-combobox";
import { Flag } from "@/components/flags";
import { modelsFor } from "@/lib/car-models";
import { CAR_VIEWS, type CarView } from "@/lib/car-views";
import { useRouter } from "@/i18n/navigation";
import { localeMeta, locales, type Locale } from "@/i18n/config";
import { carCategoryEnum, fuelEnum, transmissionEnum, type CarCategory } from "@/db/schema";
import { CAR_BRANDS } from "@/lib/car-brands";
import { ACCEPT_IMAGES, uploadFile } from "@/lib/upload-client";
import { createCar, updateCar } from "@/server/actions/fleet";
import { cn } from "@/lib/utils";

export type CarFormValues = {
  agencyId: number | "";
  brand: string;
  model: string;
  year: number | "";
  category: CarCategory;
  transmission: (typeof transmissionEnum.enumValues)[number];
  fuel: (typeof fuelEnum.enumValues)[number];
  seats: number | "";
  doors: number | "";
  luggage: number | "";
  colorName: string;
  colorHex: string;
  plateNumber: string;
  vin: string;
  mileage: number | "";
  dailyPrice: number | "";
  deposit: number | "";
  airConditioning: boolean;
  purchaseCity: string;
  purchaseDate: string;
  purchasePrice: number | "";
  descriptions: Partial<Record<Locale, string>>;
};
type Img = { publicId: string; url: string; width?: number | null; height?: number | null; view: CarView };
const SLOT_VIEWS = CAR_VIEWS.filter((v) => v !== "other");

const DEFAULTS: CarFormValues = {
  agencyId: "",
  brand: "",
  model: "",
  year: new Date().getFullYear(),
  category: "city_car",
  transmission: "manual",
  fuel: "diesel",
  seats: 5,
  doors: 5,
  luggage: 2,
  colorName: "",
  colorHex: "#9aa3b5",
  plateNumber: "",
  vin: "",
  mileage: 0,
  dailyPrice: "",
  deposit: 5000,
  airConditioning: true,
  purchaseCity: "",
  purchaseDate: "",
  purchasePrice: "",
  descriptions: {},
};

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-mist py-8 first:pt-0 last:border-0 grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {hint && <p className="mt-1 text-sm text-ink-3">{hint}</p>}
      </div>
      <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export type CarTab = "stats" | "infos" | "pricing" | "promotion" | "photos" | "descriptions" | "agency" | "managers" | "history";
/** Onglet où se trouve chaque champ, pour ouvrir le bon onglet en cas d'erreur. */
const FIELD_TAB: Record<string, CarTab> = { dailyPrice: "pricing", deposit: "pricing", images: "photos", descriptions: "descriptions", agencyId: "agency" };

export function CarForm({
  base,
  carId,
  agencies,
  initial,
  initialImages = [],
  managers = [],
  initialManagerIds = [],
  initialResponsibleIds = [],
  initialExtraAgencyIds = [],
  stats,
  history,
  promotion,
}: {
  base: string;
  carId?: string;
  agencies: { id: number; city: string; name: string }[];
  initial?: Partial<CarFormValues>;
  initialImages?: Img[];
  /** Gestionnaires actifs proposés à l'association */
  managers?: { id: string; name: string; city: string }[];
  initialManagerIds?: string[];
  /** Responsables de la voiture : ils valident ses réservations */
  initialResponsibleIds?: string[];
  /** Agences supplémentaires (en plus de l'agence principale) */
  initialExtraAgencyIds?: number[];
  /** Onglet « Statistiques » (voiture existante) */
  stats?: ReactNode;
  /** Onglet « Historique » des locations (voiture existante) */
  history?: ReactNode;
  /** Onglet « Promotion » (voiture existante) : enregistré à part */
  promotion?: ReactNode;
}) {
  const t = useTranslations("Fleet");
  const te = useTranslations("Errors");
  const tc = useTranslations("Common");
  const td = useTranslations("Documents");
  const e = useTranslations("Enums");
  const router = useRouter();
  const [v, setV] = useState<CarFormValues>({ ...DEFAULTS, ...initial });
  const [images, setImages] = useState<Img[]>(initialImages);
  const [managerIds, setManagerIds] = useState<string[]>(initialManagerIds);
  const [responsibleIds, setResponsibleIds] = useState<string[]>(initialResponsibleIds);
  const [extraAgencyIds, setExtraAgencyIds] = useState<number[]>(initialExtraAgencyIds);
  const [lang, setLang] = useState<Locale>("fr");
  const [tab, setTab] = useState<CarTab>(stats ? "stats" : "infos");
  const tabs: { id: CarTab; label: string; Icon: typeof Info }[] = [
    ...(stats ? [{ id: "stats" as const, label: t("tabStats"), Icon: BarChart3 }] : []),
    { id: "infos", label: t("tabInfos"), Icon: Info },
    { id: "pricing", label: t("tabPricing"), Icon: Tag },
    ...(promotion ? [{ id: "promotion" as const, label: t("tabPromotion"), Icon: Percent }] : []),
    { id: "photos", label: t("tabPhotos"), Icon: ImagePlus },
    { id: "descriptions", label: t("tabDescriptions"), Icon: FileText },
    { id: "agency", label: t("tabAgency"), Icon: Building2 },
    { id: "managers", label: t("tabManagers"), Icon: UsersRound },
    ...(history ? [{ id: "history" as const, label: t("tabHistory"), Icon: History }] : []),
  ];
  const models = modelsFor(v.brand);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(0);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof CarFormValues>(k: K, value: CarFormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const num = (k: keyof CarFormValues) => (x: React.ChangeEvent<HTMLInputElement>) => set(k, (x.target.value === "" ? "" : Number(x.target.value)) as never);
  const err = (k: string) => (errors[k] ? te(errors[k] as "required") : undefined);

  /** Téléverse une ou plusieurs photos pour une vue (une seule photo par vue, plusieurs pour « autres »). */
  async function addFiles(files: FileList | null, view: CarView = "other") {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, view === "other" ? Math.max(0, 20 - images.length) : 1);
    setUploading((n) => n + list.length);
    await Promise.all(
      list.map(async (f) => {
        try {
          const up = await uploadFile(f, "car");
          const img: Img = { publicId: up.publicId, url: up.url, width: up.width, height: up.height, view };
          setImages((imgs) => (view === "other" ? [...imgs, img] : [...imgs.filter((x) => x.view !== view), img]));
          if (view === "main") setErrors(({ images: _drop, ...rest }) => (void _drop, rest));
        } catch (x) {
          const code = (x as Error).message;
          toast.error(code === "too_big" ? td("tooBig") : code === "bad_type" ? td("badType") : code === "cloudinary_not_configured" ? td("notConfigured") : te("upload_failed"));
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    if (fileRef.current) fileRef.current.value = "";
  }

  /** Change la vue d'une photo déjà téléversée (ex. une ancienne photo devient « avant »). */
  function setView(publicId: string, view: CarView) {
    setImages((imgs) =>
      imgs.map((x) => (x.publicId === publicId ? { ...x, view } : view !== "other" && x.view === view ? { ...x, view: "other" } : x)),
    );
  }



  function showErrors(fe: Record<string, string>) {
    setErrors(fe);
    const first = Object.keys(fe)[0];
    if (first) setTab(FIELD_TAB[first] ?? "infos");
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setErrors({});
    // Photo principale obligatoire
    if (!images.some((i) => i.view === "main")) return showErrors({ images: "photoRequired" });
    start(async () => {
      const payload = { data: v, images, managerIds, responsibleIds, extraAgencyIds: extraAgencyIds.filter((id) => id !== v.agencyId) };
      const res = carId ? await updateCar(carId, payload) : await createCar(payload);
      if (res.ok) {
        toast.success(carId ? t("updated") : t("created"));
        router.push(`${base}/fleet/${carId ?? (res.data as { id: string }).id}`);
        router.refresh();
      } else {
        const fe = { ...(res.fieldErrors ?? {}) };
        if (res.error.startsWith("unique:cars_plate")) fe.plateNumber = res.error;
        if (res.error.startsWith("unique:cars_vin")) fe.vin = res.error;
        showErrors(fe);
        if (fe.descriptions) setLang("fr");
        toast.error(te(res.error as "unknown"));
      }
    });
  }

  const formTab = tab !== "stats" && tab !== "history" && tab !== "promotion";
  return (
    <>
    <nav aria-label={t("title")} className="scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-mist">
      {tabs.map(({ id, label, Icon }) => {
        const bad = Object.keys(errors).some((k) => (FIELD_TAB[k] ?? "infos") === id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
              tab === id ? "border-majorelle text-majorelle" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            <Icon className="size-4" />
            {label}
            {bad && <span className="size-2 rounded-full bg-danger" aria-hidden />}
          </button>
        );
      })}
    </nav>
    {tab === "stats" && stats}
    {tab === "history" && history}
    {tab === "promotion" && promotion}
    <form onSubmit={submit} noValidate className={cn("rounded-2xl border border-mist bg-paper p-6 sm:p-8", !formTab && "hidden")}>
      <div className={tab === "infos" ? undefined : "hidden"}>
      <Section title={t("general")}>
        <Field label={t("brand")} required error={err("brand")}>
          {(p) => (
            <Select {...p} value={v.brand} onChange={(x) => set("brand", x.target.value)}>
              <option value="">—</option>
              {/* Une marque saisie avant la liste officielle reste sélectionnable */}
              {v.brand && !(CAR_BRANDS as readonly string[]).includes(v.brand) && <option value={v.brand}>{v.brand}</option>}
              {CAR_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("model")} required error={err("model")} hint={v.brand ? undefined : t("chooseBrandFirst")}>
          {(p) => (
            <SuggestCombobox
              {...p}
              free
              disabled={!v.brand}
              options={models}
              value={v.model}
              onChange={(m) => set("model", m)}
              labels={{ search: t("searchModel"), choose: t("chooseModel"), noResult: t("noModel"), useTyped: (q) => t("useModel", { model: q }) }}
            />
          )}
        </Field>
        <Field label={t("year")} required error={err("year")}>{(p) => <Input {...p} type="number" min={1990} max={2100} value={v.year} onChange={num("year")} />}</Field>
        <Field label={t("plateNumber")} required error={err("plateNumber")}>{(p) => <Input {...p} dir="ltr" className="font-mono uppercase" placeholder="12345-A-40" value={v.plateNumber} onChange={(x) => set("plateNumber", x.target.value)} />}</Field>
        <Field label={t("vin")} optionalLabel={tc("optional")} error={err("vin")}>{(p) => <Input {...p} dir="ltr" maxLength={17} className="font-mono uppercase" value={v.vin} onChange={(x) => set("vin", x.target.value)} />}</Field>
      </Section>

      <Section title={t("technical")}>
        <Field label={t("category")} required>
          {(p) => (
            <Select {...p} value={v.category} onChange={(x) => set("category", x.target.value as CarCategory)}>
              {carCategoryEnum.enumValues.map((c) => <option key={c} value={c}>{e(`category.${c}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("transmission")} required>
          {(p) => (
            <Select {...p} value={v.transmission} onChange={(x) => set("transmission", x.target.value as CarFormValues["transmission"])}>
              {transmissionEnum.enumValues.map((c) => <option key={c} value={c}>{e(`transmission.${c}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("fuel")} required>
          {(p) => (
            <Select {...p} value={v.fuel} onChange={(x) => set("fuel", x.target.value as CarFormValues["fuel"])}>
              {fuelEnum.enumValues.map((c) => <option key={c} value={c}>{e(`fuel.${c}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("seats")} required error={err("seats")}>{(p) => <Input {...p} type="number" min={1} max={20} value={v.seats} onChange={num("seats")} />}</Field>
        <Field label={t("doors")} required error={err("doors")}>{(p) => <Input {...p} type="number" min={2} max={6} value={v.doors} onChange={num("doors")} />}</Field>
        <Field label={t("luggage")} required error={err("luggage")}>{(p) => <Input {...p} type="number" min={0} max={10} value={v.luggage} onChange={num("luggage")} />}</Field>
        <Field label={t("colorName")} required error={err("colorName")}>{(p) => <Input {...p} value={v.colorName} onChange={(x) => set("colorName", x.target.value)} />}</Field>
        <Field label={t("colorHex")} required>
          {(p) => (
            <div className="flex items-center gap-3">
              <input {...p} type="color" value={v.colorHex} onChange={(x) => set("colorHex", x.target.value)} className="h-11 w-14 cursor-pointer rounded-[10px] border border-mist-2 bg-paper p-1" />
              <CarArt category={v.category} color={v.colorHex} className="h-11 w-28" />
            </div>
          )}
        </Field>
        <Field label={t("mileage")} required error={err("mileage")}>{(p) => <Input {...p} type="number" min={0} step={100} value={v.mileage} onChange={num("mileage")} />}</Field>
        <div className="flex items-end pb-2.5">
          <Checkbox label={t("airConditioning")} checked={v.airConditioning} onChange={(x) => set("airConditioning", x.target.checked)} />
        </div>
      </Section>

      </div>
      <div className={tab === "pricing" ? undefined : "hidden"}>
      <Section title={t("pricing")}>
        <Field label={t("dailyPrice")} required error={err("dailyPrice")}>{(p) => <Input {...p} type="number" min={1} step={10} value={v.dailyPrice} onChange={num("dailyPrice")} />}</Field>
        <Field label={t("deposit")} required error={err("deposit")}>{(p) => <Input {...p} type="number" min={0} step={500} value={v.deposit} onChange={num("deposit")} />}</Field>
      </Section>

      </div>
      <div className={tab === "infos" ? undefined : "hidden"}>
      <Section title={t("purchase")} hint={t("purchaseHint")}>
        <Field label={t("purchaseCity")} required error={err("purchaseCity")}>{(p) => <CityCombobox {...p} value={v.purchaseCity} onChange={(c) => set("purchaseCity", c)} />}</Field>
        <Field label={t("purchaseDate")} required error={err("purchaseDate")}>{(p) => <Input {...p} type="date" max={new Date().toISOString().slice(0, 10)} value={v.purchaseDate} onChange={(x) => set("purchaseDate", x.target.value)} />}</Field>
        <Field label={t("purchasePrice")} required error={err("purchasePrice")}>{(p) => <Input {...p} type="number" min={0} step={1000} value={v.purchasePrice} onChange={num("purchasePrice")} />}</Field>
      </Section>

      </div>
      <section className={cn("grid gap-6 py-2 grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]", tab !== "managers" && "hidden")}>
        <div>
          <h2 className="text-[15px] font-bold text-ink">{t("assignedManagers")}</h2>
          <p className="mt-1 text-sm text-ink-3">{t("assignedManagersHint")}</p>
        </div>
        <div>
          {managers.length === 0 ? (
            <p className="text-sm text-ink-3">{t("noManagers")}</p>
          ) : (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("assignedManagers")}>
              {managers.map((m) => {
                const on = managerIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setManagerIds((ids) => (on ? ids.filter((x) => x !== m.id) : [...ids, m.id]))}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      on ? "border-majorelle bg-majorelle-soft text-majorelle" : "border-mist-2 bg-paper text-ink-2 hover:border-ink-3",
                    )}
                  >
                    <span className={cn("grid size-4 place-items-center rounded-full border", on ? "border-majorelle bg-majorelle text-white" : "border-mist-2")}>
                      {on && <Check className="size-3" />}
                    </span>
                    {m.name}
                    <span className="text-xs text-ink-3">{m.city}</span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-sm font-medium text-ink-2">
            {managerIds.length === 0 ? t("allManagers") : t("someManagers", { count: managerIds.length })}
          </p>
        </div>
      </section>

      <section className={cn("mt-8 grid gap-6 border-t border-mist pt-8 grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]", tab !== "managers" && "hidden")}>
        <div>
          <h2 className="text-[15px] font-bold text-ink">{t("carResponsibles")}</h2>
          <p className="mt-1 text-sm text-ink-3">{t("carResponsiblesHint")}</p>
        </div>
        <div>
          <Chips
            label={t("carResponsibles")}
            items={managers.map((m) => ({ id: m.id, label: m.name, sub: m.city }))}
            value={responsibleIds}
            onChange={setResponsibleIds}
          />
          <p className="mt-3 text-sm font-medium text-ink-2">
            {responsibleIds.length === 0 ? t("noCarResponsible") : t("someCarResponsibles", { count: responsibleIds.length })}
          </p>
        </div>
      </section>

      <section className={cn("space-y-6", tab !== "photos" && "hidden")}>
        <div>
          <h2 className="text-[15px] font-bold text-ink">{t("photos")}</h2>
          <p className="mt-1 text-sm text-ink-3">{t("photosViewsHint")}</p>
          {errors.images && <p className="mt-2 text-sm font-semibold text-danger" role="alert">{t("photoRequired")}</p>}
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {SLOT_VIEWS.map((view) => {
            const img = images.find((x) => x.view === view);
            const main = view === "main";
            return (
              <li key={view} className={cn(main && "col-span-2 row-span-2")}>
                <PhotoSlot
                  label={t(`view.${view}`)}
                  required={main}
                  invalid={main && Boolean(errors.images)}
                  img={img}
                  big={main}
                  busy={uploading > 0}
                  onPick={(f) => addFiles(f, view)}
                  onRemove={img ? () => setImages((imgs) => imgs.filter((x) => x.publicId !== img.publicId)) : undefined}
                  labels={{ add: t("addPhoto"), replace: t("replacePhoto"), remove: t("removePhoto"), optional: tc("optional"), required: t("required") }}
                />
              </li>
            );
          })}
        </ul>
        <div>
          <h3 className="text-sm font-bold text-ink">{t("otherPhotos")}</h3>
          <p className="mt-0.5 text-sm text-ink-3">{t("otherPhotosHint")}</p>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {images
              .filter((x) => x.view === "other")
              .map((img) => (
                <li key={img.publicId} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-mist bg-chalk">
                  <img src={img.url} alt="" className="size-full object-cover" />
                  <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1">
                    <select
                      aria-label={t("photoView")}
                      value="other"
                      onChange={(x) => setView(img.publicId, x.target.value as CarView)}
                      className="h-8 max-w-[8rem] rounded-lg bg-paper/95 px-1.5 text-xs font-semibold text-ink shadow"
                    >
                      {CAR_VIEWS.map((v) => <option key={v} value={v}>{t(`view.${v}`)}</option>)}
                    </select>
                    <button type="button" onClick={() => setImages((imgs) => imgs.filter((x) => x.publicId !== img.publicId))} title={t("removePhoto")} aria-label={t("removePhoto")} className="grid size-8 place-items-center rounded-lg bg-paper/95 text-danger shadow">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            {images.length < 20 && (
              <li>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(x) => x.preventDefault()}
                  onDrop={(x) => { x.preventDefault(); void addFiles(x.dataTransfer.files, "other"); }}
                  className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-mist-2 text-sm font-semibold text-ink-3 transition-colors hover:border-majorelle hover:text-majorelle"
                >
                  {uploading ? <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <ImagePlus className="size-6" />}
                  {uploading ? td("uploading") : t("addPhotos")}
                </button>
                <input ref={fileRef} type="file" accept={ACCEPT_IMAGES} multiple className="sr-only" onChange={(x) => addFiles(x.target.files, "other")} />
              </li>
            )}
          </ul>
        </div>
      </section>

      <section className={cn("grid gap-6 py-2 grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]", tab !== "agency" && "hidden")}>
        <div>
          <h2 className="text-[15px] font-bold text-ink">{t("tabAgency")}</h2>
          <p className="mt-1 text-sm text-ink-3">{t("agencyHint")}</p>
        </div>
        <div className="grid min-w-0 gap-4 sm:max-w-xl">
          <Field label={t("agency")} required error={err("agencyId")}>
            {(p) => (
              <Select {...p} value={v.agencyId} onChange={(x) => set("agencyId", x.target.value ? Number(x.target.value) : "")}>
                <option value="">—</option>
                {agencies.map((a) => <option key={a.id} value={a.id}>{a.city} : {a.name}</option>)}
              </Select>
            )}
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink">{t("extraAgencies")}</p>
            <p className="mb-3 text-sm text-ink-3">{t("extraAgenciesHint")}</p>
            <Chips
              label={t("extraAgencies")}
              items={agencies.filter((a) => a.id !== v.agencyId).map((a) => ({ id: a.id, label: a.name, sub: a.city }))}
              value={extraAgencyIds}
              onChange={setExtraAgencyIds}
            />
          </div>
        </div>
      </section>

      <section className={cn("grid gap-6 py-2 grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]", tab !== "descriptions" && "hidden")}>
        <div>
          <h2 className="text-[15px] font-bold text-ink">{t("descriptions")}</h2>
          <p className="mt-1 text-sm text-ink-3">{t("descriptionsHint")}</p>
        </div>
        <div>
          <div role="tablist" className="scroll-thin mb-3 flex gap-1 overflow-x-auto rounded-[10px] bg-chalk p-1">
            {locales.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={lang === l}
                onClick={() => setLang(l)}
                className={cn("relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", lang === l ? "bg-paper text-ink shadow-sm" : "text-ink-3 hover:text-ink")}
              >
                <Flag locale={l} className="h-3.5 w-5" />
                {localeMeta[l].native}
                {(v.descriptions[l] ?? "").trim() && <span className="ms-1.5 inline-block size-1.5 rounded-full bg-palm align-middle" aria-hidden />}
              </button>
            ))}
          </div>
          <Field label={<span className="inline-flex items-center gap-2"><Flag locale={lang} className="h-3.5 w-5" />{localeMeta[lang].native}</span>} required={lang === "fr"} error={lang === "fr" ? err("descriptions") : undefined}>
            {(p) => (
              <Textarea
                {...p}
                key={lang}
                dir={localeMeta[lang].dir}
                lang={lang === "ary" ? "ar" : lang}
                rows={5}
                value={v.descriptions[lang] ?? ""}
                onChange={(x) => set("descriptions", { ...v.descriptions, [lang]: x.target.value })}
              />
            )}
          </Field>
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t border-mist pt-6">
        <Button type="button" variant="ghost" onClick={() => router.back()}>{tc("cancel")}</Button>
        <Button type="submit" loading={pending} disabled={uploading > 0}>{pending ? tc("saving") : tc("save")}</Button>
      </div>
    </form>
    </>
  );
}

/** Emplacement d'une vue (principale, avant, arrière…) : ajouter, remplacer ou retirer sa photo. */
function PhotoSlot({
  label,
  required,
  invalid,
  img,
  big,
  busy,
  onPick,
  onRemove,
  labels,
}: {
  label: string;
  required: boolean;
  invalid: boolean;
  img?: Img;
  big: boolean;
  busy: boolean;
  onPick: (files: FileList | null) => void;
  onRemove?: () => void;
  labels: { add: string; replace: string; remove: string; optional: string; required: string };
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(x) => x.preventDefault()}
      onDrop={(x) => { x.preventDefault(); onPick(x.dataTransfer.files); }}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border bg-chalk",
        big ? "min-h-64" : "aspect-[4/3]",
        img ? (required ? "border-majorelle ring-2 ring-majorelle/25" : "border-mist") : invalid ? "border-2 border-dashed border-danger" : "border-2 border-dashed border-mist-2",
      )}
    >
      {img ? (
        <img src={img.url} alt={label} className="absolute inset-0 size-full object-cover" />
      ) : (
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex flex-1 flex-col items-center justify-center gap-1.5 px-2 text-center text-sm font-semibold text-ink-3 hover:text-majorelle">
          {required ? <Star className="size-6" /> : <Camera className="size-5" />}
          {labels.add}
        </button>
      )}
      <span className={cn("absolute start-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow", required ? "bg-majorelle text-white" : "bg-paper/95 text-ink")}>
        {required && <Star className="size-3.5 fill-current" />}
        {label}
        <span className="font-normal opacity-80">· {required ? labels.required : labels.optional}</span>
      </span>
      {img && (
        <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1">
          <button type="button" onClick={() => input.current?.click()} className="inline-flex h-8 items-center gap-1 rounded-lg bg-paper/95 px-2 text-xs font-semibold text-ink shadow">
            <ImagePlus className="size-4" />
            {labels.replace}
          </button>
          {onRemove && (
            <button type="button" onClick={onRemove} title={labels.remove} aria-label={labels.remove} className="grid size-8 place-items-center rounded-lg bg-paper/95 text-danger shadow">
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      )}
      <input ref={input} type="file" accept={ACCEPT_IMAGES} className="sr-only" onChange={(x) => onPick(x.target.files)} />
    </div>
  );
}

/** Liste de pastilles à cocher (0 ou plusieurs). */
function Chips<K extends string | number>({ label, items, value, onChange }: { label: string; items: { id: K; label: string; sub?: string }[]; value: K[]; onChange: (next: K[]) => void }) {
  if (!items.length) return <p className="text-sm text-ink-3">—</p>;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {items.map((m) => {
        const on = value.includes(m.id);
        return (
          <button
            key={String(m.id)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id])}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              on ? "border-majorelle bg-majorelle-soft text-majorelle" : "border-mist-2 bg-paper text-ink-2 hover:border-ink-3",
            )}
          >
            <span className={cn("grid size-4 place-items-center rounded-full border", on ? "border-majorelle bg-majorelle text-white" : "border-mist-2")}>
              {on && <Check className="size-3" />}
            </span>
            {m.label}
            {m.sub && <span className="text-xs text-ink-3">{m.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
