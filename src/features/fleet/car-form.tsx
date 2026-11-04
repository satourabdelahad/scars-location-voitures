"use client";

/* eslint-disable @next/next/no-img-element */
import { Check, ImagePlus, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { CarArt } from "@/components/car-art";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
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
type Img = { publicId: string; url: string; width?: number | null; height?: number | null };

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
    <section className="grid gap-6 border-b border-mist py-8 first:pt-0 last:border-0 lg:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {hint && <p className="mt-1 text-sm text-ink-3">{hint}</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export function CarForm({
  base,
  carId,
  agencies,
  initial,
  initialImages = [],
  managers = [],
  initialManagerIds = [],
}: {
  base: string;
  carId?: string;
  agencies: { id: number; city: string; name: string }[];
  initial?: Partial<CarFormValues>;
  initialImages?: Img[];
  /** Gestionnaires actifs proposés à l'association */
  managers?: { id: string; name: string; city: string }[];
  initialManagerIds?: string[];
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
  const [lang, setLang] = useState<Locale>("fr");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(0);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);

  const set = <K extends keyof CarFormValues>(k: K, value: CarFormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const num = (k: keyof CarFormValues) => (x: React.ChangeEvent<HTMLInputElement>) => set(k, (x.target.value === "" ? "" : Number(x.target.value)) as never);
  const err = (k: string) => (errors[k] ? te(errors[k] as "required") : undefined);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 12 - images.length);
    setUploading((n) => n + list.length);
    await Promise.all(
      list.map(async (f) => {
        try {
          const up = await uploadFile(f, "car");
          setImages((imgs) => [...imgs, { publicId: up.publicId, url: up.url, width: up.width, height: up.height }]);
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

  function move(from: number, to: number) {
    setImages((imgs) => {
      const next = [...imgs];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setErrors({});
    start(async () => {
      const payload = { data: v, images, managerIds };
      const res = carId ? await updateCar(carId, payload) : await createCar(payload);
      if (res.ok) {
        toast.success(carId ? t("updated") : t("created"));
        router.push(`${base}/fleet/${carId ?? (res.data as { id: string }).id}`);
        router.refresh();
      } else {
        const fe = { ...(res.fieldErrors ?? {}) };
        if (res.error.startsWith("unique:cars_plate")) fe.plateNumber = res.error;
        if (res.error.startsWith("unique:cars_vin")) fe.vin = res.error;
        setErrors(fe);
        if (fe.descriptions) setLang("fr");
        toast.error(te(res.error as "unknown"));
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-mist bg-paper p-6 sm:p-8">
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
        <Field label={t("model")} required error={err("model")}>{(p) => <Input {...p} value={v.model} onChange={(x) => set("model", x.target.value)} />}</Field>
        <Field label={t("year")} required error={err("year")}>{(p) => <Input {...p} type="number" min={1990} max={2100} value={v.year} onChange={num("year")} />}</Field>
        <Field label={t("plateNumber")} required error={err("plateNumber")}>{(p) => <Input {...p} dir="ltr" className="font-mono uppercase" placeholder="12345-A-40" value={v.plateNumber} onChange={(x) => set("plateNumber", x.target.value)} />}</Field>
        <Field label={t("vin")} optionalLabel={tc("optional")} error={err("vin")}>{(p) => <Input {...p} dir="ltr" maxLength={17} className="font-mono uppercase" value={v.vin} onChange={(x) => set("vin", x.target.value)} />}</Field>
        <Field label={t("agency")} required error={err("agencyId")}>
          {(p) => (
            <Select {...p} value={v.agencyId} onChange={(x) => set("agencyId", x.target.value ? Number(x.target.value) : "")}>
              <option value="">—</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.city} : {a.name}</option>)}
            </Select>
          )}
        </Field>
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

      <Section title={t("pricing")}>
        <Field label={t("dailyPrice")} required error={err("dailyPrice")}>{(p) => <Input {...p} type="number" min={1} step={10} value={v.dailyPrice} onChange={num("dailyPrice")} />}</Field>
        <Field label={t("deposit")} required error={err("deposit")}>{(p) => <Input {...p} type="number" min={0} step={500} value={v.deposit} onChange={num("deposit")} />}</Field>
      </Section>

      <Section title={t("purchase")} hint={t("purchaseHint")}>
        <Field label={t("purchaseCity")} required error={err("purchaseCity")}>{(p) => <Input {...p} value={v.purchaseCity} onChange={(x) => set("purchaseCity", x.target.value)} />}</Field>
        <Field label={t("purchaseDate")} required error={err("purchaseDate")}>{(p) => <Input {...p} type="date" max={new Date().toISOString().slice(0, 10)} value={v.purchaseDate} onChange={(x) => set("purchaseDate", x.target.value)} />}</Field>
        <Field label={t("purchasePrice")} required error={err("purchasePrice")}>{(p) => <Input {...p} type="number" min={0} step={1000} value={v.purchasePrice} onChange={num("purchasePrice")} />}</Field>
      </Section>

      <section className="grid gap-6 border-b border-mist py-8 lg:grid-cols-[220px_1fr]">
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

      <section className="grid gap-6 border-b border-mist py-8 lg:grid-cols-[220px_1fr]">
        <div>
          <h2 className="text-[15px] font-bold text-ink">{t("photos")}</h2>
          <p className="mt-1 text-sm text-ink-3">{t("photosHint")}</p>
        </div>
        <div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {images.map((img, i) => (
              <li
                key={img.publicId}
                draggable
                onDragStart={() => (dragFrom.current = i)}
                onDragOver={(x) => x.preventDefault()}
                onDrop={() => { if (dragFrom.current !== null && dragFrom.current !== i) move(dragFrom.current, i); dragFrom.current = null; }}
                className={cn(
                  "group relative cursor-grab overflow-hidden rounded-xl border bg-chalk active:cursor-grabbing",
                  i === 0 ? "col-span-2 row-span-2 border-majorelle ring-2 ring-majorelle/25" : "aspect-[4/3] border-mist",
                )}
              >
                <img src={img.url} alt="" className="size-full object-cover" />
                {i === 0 && (
                  <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-majorelle px-2.5 py-1 text-xs font-bold text-white shadow">
                    <Star className="size-3.5 fill-current" />
                    {t("mainPhoto")}
                  </span>
                )}
                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  {i > 0 && (
                    <button type="button" onClick={() => move(i, 0)} title={t("makeCover")} aria-label={t("makeCover")} className="inline-flex h-8 items-center gap-1 rounded-lg bg-paper/95 px-2 text-xs font-semibold text-ink shadow">
                      <Star className="size-4" />
                      <span className="hidden xl:inline">{t("makeCoverShort")}</span>
                    </button>
                  )}
                  <button type="button" onClick={() => setImages((imgs) => imgs.filter((x) => x.publicId !== img.publicId))} title={t("removePhoto")} aria-label={t("removePhoto")} className="grid size-8 place-items-center rounded-lg bg-paper/95 text-danger shadow">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
            {images.length < 12 && (
              <li>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(x) => x.preventDefault()}
                  onDrop={(x) => { x.preventDefault(); void addFiles(x.dataTransfer.files); }}
                  className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-mist-2 text-sm font-semibold text-ink-3 transition-colors hover:border-majorelle hover:text-majorelle"
                >
                  {uploading ? <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <ImagePlus className="size-6" />}
                  {uploading ? td("uploading") : t("addPhotos")}
                </button>
                <input ref={fileRef} type="file" accept={ACCEPT_IMAGES} multiple className="sr-only" onChange={(x) => addFiles(x.target.files)} />
              </li>
            )}
          </ul>
          {images.length === 0 && <p className="mt-3 text-sm text-ink-3">{t("noPhotos")}</p>}
        </div>
      </section>

      <section className="grid gap-6 py-8 lg:grid-cols-[220px_1fr]">
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
                className={cn("relative shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", lang === l ? "bg-paper text-ink shadow-sm" : "text-ink-3 hover:text-ink")}
              >
                {localeMeta[l].native}
                {(v.descriptions[l] ?? "").trim() && <span className="ms-1.5 inline-block size-1.5 rounded-full bg-palm align-middle" aria-hidden />}
              </button>
            ))}
          </div>
          <Field label={localeMeta[lang].native} required={lang === "fr"} error={lang === "fr" ? err("descriptions") : undefined}>
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
  );
}
