import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CarArt } from "@/components/car-art";

export default async function NotFound() {
  const t = await getTranslations("Common");
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <CarArt category="convertible" color="#f2b53a" className="w-64 opacity-90" />
      <h1 className="display-md mt-6 text-4xl text-ink">{t("notFoundTitle")}</h1>
      <p className="mt-3 text-ink-3">{t("notFoundBody")}</p>
      <Link href="/" className="mt-8 rounded-xl bg-majorelle px-6 py-3 font-semibold text-white">{t("goHome")}</Link>
    </main>
  );
}
