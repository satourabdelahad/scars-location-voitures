import "server-only";
import { cache } from "react";
import { listAgencies } from "@/server/queries/cars";
import { getSiteSettings } from "@/server/site-settings";

/**
 * Données communes du site public : agences actives et coordonnées de contact.
 * Sans coordonnées saisies dans le back office, on reprend celles de la première agence.
 * Avec une seule agence (ou aucune), le menu « Agences » disparaît.
 */
export const publicSite = cache(async () => {
  const [agencies, settings] = await Promise.all([listAgencies(), getSiteSettings()]);
  const first = agencies[0];
  const c = settings.contact;
  const contact = {
    address: c.address || (first ? `${first.address}, ${first.city}` : ""),
    email: c.email,
    phone: c.phone || first?.phone || "",
    whatsapp: c.whatsapp || first?.whatsapp || first?.phone || "",
  };
  return { agencies, settings, contact, multiAgency: agencies.length > 1 };
});

export const waLink = (n: string) => `https://wa.me/${n.replace(/\D/g, "")}`;
