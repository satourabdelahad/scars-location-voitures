import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CONTRACT_CSS } from "@/lib/contract";
import { requireRole } from "@/server/guards";
import { assertReservationInScope } from "@/server/agency-scope";
import { renderContract } from "@/server/contract";
import { PrintBar } from "@/features/reservations/print-bar";

/** Contrat de location d'une réservation, prêt à imprimer ou à enregistrer en PDF. */
export default async function ContractPage({ params }: PageProps<"/[locale]/contract/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireRole(["admin", "manager"], `/contract/${id}`);
  try {
    await assertReservationInScope(user, id);
  } catch {
    notFound();
  }
  const [doc, t] = await Promise.all([renderContract(id, locale), getTranslations("Contract")]);
  if (!doc) notFound();
  return (
    <div className="min-h-dvh bg-mist/60 py-8 print:bg-white print:py-0">
      <style>{`${CONTRACT_CSS}
@page{size:A4;margin:14mm}
@media print{.no-print{display:none!important}.sheet{box-shadow:none!important;margin:0!important;padding:0!important;max-width:none!important}}`}</style>
      <PrintBar title={t("printTitle", { reference: doc.reference })} back={user.role === "admin" ? `/admin/reservations/${id}` : `/manager/reservations/${id}`} />
      <article className="sheet contract mx-auto max-w-[794px] bg-white p-12 text-black shadow-[0_10px_40px_-15px_rgba(0,0,0,.35)]" dir="ltr">
        <div dangerouslySetInnerHTML={{ __html: doc.header }} />
        <hr style={{ margin: "16px 0", borderColor: "#ddd" }} />
        <div dangerouslySetInnerHTML={{ __html: doc.body }} />
      </article>
    </div>
  );
}
