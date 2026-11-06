/** Modèles d'email modifiables dans Administration. Partagé navigateur / serveur (pas de secrets ici). */
export const TEMPLATE_KEYS = ["manager_invite", "client_invite", "car_created", "reservation_created", "prospect_followup", "manager_password_set", "car_agency_assigned", "manager_agency_joined", "marketing_promotion"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/** Variables disponibles par modèle, avec une valeur d'exemple pour l'aperçu. */
export const TEMPLATE_VARIABLES: Record<TemplateKey, { key: string; sample: string }[]> = {
  manager_invite: [
    { key: "civilite", sample: "Madame" },
    { key: "prenom", sample: "Salma" },
    { key: "nom", sample: "Bennani" },
    { key: "email", sample: "salma@dizy-cars.com" },
    { key: "telephone", sample: "+212 6 61 23 45 02" },
    { key: "ville", sample: "Casablanca" },
    { key: "type_contrat", sample: "CDI" },
    { key: "date_debut", sample: "1 décembre 2026" },
    { key: "lien_invitation", sample: "https://dizy-cars.com/fr/set-password?token=…" },
    { key: "bouton_invitation", sample: "[bouton]" },
    { key: "site", sample: "Dizy Cars" },
  ],
  client_invite: [
    { key: "civilite", sample: "Monsieur" },
    { key: "prenom", sample: "Youssef" },
    { key: "nom", sample: "Alaoui" },
    { key: "email", sample: "youssef@gmail.com" },
    { key: "ajoute_par", sample: "Salma Bennani" },
    { key: "lien_invitation", sample: "https://dizy-cars.com/fr/set-password?token=…" },
    { key: "bouton_invitation", sample: "[bouton]" },
    { key: "site", sample: "Dizy Cars" },
  ],
  car_created: [
    { key: "marque", sample: "BYD" },
    { key: "modele", sample: "Seal U DM-i" },
    { key: "annee", sample: "2026" },
    { key: "carrosserie", sample: "SUV et 4x4" },
    { key: "motorisation", sample: "Hybride rechargeable" },
    { key: "transmission", sample: "Automatique" },
    { key: "immatriculation", sample: "77777-A-6" },
    { key: "couleur", sample: "Gris" },
    { key: "prix_jour", sample: "700 MAD" },
    { key: "agence", sample: "Casablanca, Aéroport Mohammed V" },
    { key: "gestionnaires", sample: "Tous les gestionnaires" },
    { key: "ajoute_par", sample: "Administrateur" },
    { key: "lien_voiture", sample: "https://dizy-cars.com/fr/admin/fleet/…" },
    { key: "bouton_voiture", sample: "[bouton]" },
    { key: "site", sample: "Dizy Cars" },
  ],
  reservation_created: [
    { key: "reference", sample: "DZ-2026-00421" },
    { key: "destinataire", sample: "Youssef" },
    { key: "client_nom", sample: "Youssef Alaoui" },
    { key: "client_email", sample: "youssef@gmail.com" },
    { key: "client_telephone", sample: "+212 6 12 34 56 78" },
    { key: "marque", sample: "Dacia" },
    { key: "modele", sample: "Duster" },
    { key: "annee", sample: "2025" },
    { key: "carrosserie", sample: "SUV et 4x4" },
    { key: "motorisation", sample: "Diesel" },
    { key: "transmission", sample: "Manuelle" },
    { key: "immatriculation", sample: "78901-A-40" },
    { key: "date_debut", sample: "12 décembre 2026" },
    { key: "date_fin", sample: "16 décembre 2026" },
    { key: "jours", sample: "4" },
    { key: "prix_jour", sample: "420 MAD" },
    { key: "options", sample: "Siège bébé, GPS" },
    { key: "code_promo", sample: "BIENVENUE10" },
    { key: "remise", sample: "168 MAD" },
    { key: "total", sample: "1 512 MAD" },
    { key: "caution", sample: "8 000 MAD" },
    { key: "agence_depart", sample: "Marrakech, Guéliz" },
    { key: "agence_retour", sample: "Marrakech, Aéroport" },
    { key: "numero_vol", sample: "AT 801" },
    { key: "lien_reservation", sample: "https://dizy-cars.com/fr/account" },
    { key: "bouton_reservation", sample: "[bouton]" },
    { key: "site", sample: "Dizy Cars" },
  ],
  prospect_followup: [
    { key: "prenom", sample: "Youssef" },
    { key: "nom", sample: "Alaoui" },
    { key: "type_prospection", sample: "Appel téléphonique" },
    { key: "date", sample: "4 novembre 2026" },
    { key: "heure", sample: "15:30" },
    { key: "note", sample: "Intéressé par un SUV automatique pour 10 jours en décembre." },
    { key: "prochaine_action", sample: "Envoyer un devis pour une Dacia Duster" },
    { key: "gestionnaire", sample: "Salma Bennani" },
    { key: "gestionnaire_telephone", sample: "+212 6 61 23 45 02" },
    { key: "gestionnaire_email", sample: "salma@dizy-cars.com" },
    { key: "lien_site", sample: "https://dizy-cars.com/fr/cars" },
    { key: "bouton_site", sample: "[bouton]" },
    { key: "site", sample: "Dizy Cars" },
  ],
  manager_password_set: [
    { key: "civilite", sample: "Madame" },
    { key: "prenom", sample: "Salma" },
    { key: "nom", sample: "Bennani" },
    { key: "email", sample: "salma@dizy-cars.com" },
    { key: "mot_de_passe", sample: "Nouveau2026!" },
    { key: "modifie_par", sample: "Hicham (Administrateur)" },
    { key: "lien_connexion", sample: "https://dizy-cars.com/fr/login" },
    { key: "bouton_connexion", sample: "[bouton]" },
    { key: "site", sample: "Dizy Cars" },
  ],
  car_agency_assigned: [
    { key: "destinataire", sample: "Salma" },
    { key: "agence", sample: "Casablanca, Aéroport Mohammed V" },
    { key: "nombre_voitures", sample: "2" },
    { key: "voitures", sample: "Dacia Duster (78901-A-40), BYD Seal U DM-i (77777-A-6)" },
    { key: "ajoute_par", sample: "Hicham (Administrateur)" },
    { key: "lien_agence", sample: "https://dizy-cars.com/fr/manager/agencies/1?tab=cars" },
    { key: "bouton_agence", sample: "[bouton]" },
    { key: "site", sample: "Dizy Cars" },
  ],
  manager_agency_joined: [
    { key: "destinataire", sample: "Salma" },
    { key: "civilite", sample: "Monsieur" },
    { key: "prenom", sample: "Karim" },
    { key: "nom", sample: "Tazi" },
    { key: "email", sample: "karim@dizy-cars.com" },
    { key: "telephone", sample: "+212 6 61 23 45 07" },
    { key: "agence", sample: "Marrakech, Guéliz" },
    { key: "ajoute_par", sample: "Hicham (Administrateur)" },
    { key: "lien_agence", sample: "https://dizy-cars.com/fr/manager/agencies/2?tab=managers" },
    { key: "bouton_agence", sample: "[bouton]" },
    { key: "site", sample: "Dizy Cars" },
  ],
  marketing_promotion: [
    { key: "civilite", sample: "Monsieur" },
    { key: "prenom", sample: "Youssef" },
    { key: "nom", sample: "Alaoui" },
    { key: "message", sample: "Profitez de l'hiver pour découvrir le Maroc au volant." },
    { key: "code_promo", sample: "HIVER-7KQ2" },
    { key: "remise", sample: "15 %" },
    { key: "date_fin", sample: "31 décembre 2026" },
    { key: "jours_min", sample: "3" },
    { key: "lien_promo", sample: "https://dizy-cars.com/fr/promo/…" },
    { key: "bouton_promo", sample: "[bouton]" },
    { key: "site", sample: "Dizy Cars" },
  ],
};

/** Variables qui insèrent un bloc HTML (bouton) au lieu d'un texte. */
export const RAW_VARIABLES = new Set(["bouton_invitation", "bouton_voiture", "bouton_reservation", "bouton_site", "bouton_connexion", "bouton_agence", "bouton_promo"]);


/** Remplace les {{variables}} ; les valeurs texte sont échappées, les boutons sont insérés tels quels. */
export function fillTemplate(text: string, vars: Record<string, string>, { html }: { html: boolean }) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    if (v === undefined) return "";
    if (!html) return RAW_VARIABLES.has(k) ? "" : v;
    return RAW_VARIABLES.has(k) ? v : escapeHtml(v);
  });
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Bouton d'action aux couleurs de Dizy Cars (compatible clients email). */
export function emailButton(label: string, href: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#4b3fd8;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">${escapeHtml(label)}</a>`;
}
