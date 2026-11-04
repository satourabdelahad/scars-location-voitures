/** Modèles d'email modifiables dans Administration. Partagé navigateur / serveur (pas de secrets ici). */
export const TEMPLATE_KEYS = ["manager_invite", "car_created", "reservation_created"] as const;
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
};

/** Variables qui insèrent un bloc HTML (bouton) au lieu d'un texte. */
export const RAW_VARIABLES = new Set(["bouton_invitation", "bouton_voiture", "bouton_reservation"]);

export const DEFAULT_TEMPLATES: Record<TemplateKey, { subject: string; html: string }> = {
  manager_invite: {
    subject: "Bienvenue chez {{site}}, {{prenom}} : activez votre compte",
    html: `<h2>Bonjour {{civilite}} {{prenom}} {{nom}},</h2>
<p>Vous rejoignez l'équipe <strong>{{site}}</strong> en tant que gestionnaire à {{ville}} (contrat {{type_contrat}}, à partir du {{date_debut}}).</p>
<p>Pour accéder à votre espace, choisissez votre mot de passe avec le bouton ci-dessous. Ce lien est valable 7 jours.</p>
<p>{{bouton_invitation}}</p>
<p>Votre identifiant de connexion : <strong>{{email}}</strong></p>
<p>À très vite,<br>L'équipe {{site}}</p>`,
  },
  car_created: {
    subject: "Nouvelle voiture au parc : {{marque}} {{modele}} ({{immatriculation}})",
    html: `<h2>Une nouvelle voiture rejoint le parc</h2>
<p><strong>{{marque}} {{modele}}</strong> ({{annee}}), {{carrosserie}}, {{motorisation}}, boîte {{transmission}}.</p>
<ul>
<li>Immatriculation : {{immatriculation}}</li>
<li>Couleur : {{couleur}}</li>
<li>Prix par jour : {{prix_jour}}</li>
<li>Agence : {{agence}}</li>
<li>Gestionnaires : {{gestionnaires}}</li>
</ul>
<p>Ajoutée par {{ajoute_par}}.</p>
<p>{{bouton_voiture}}</p>`,
  },
  reservation_created: {
    subject: "Réservation {{reference}} : {{marque}} {{modele}} du {{date_debut}} au {{date_fin}}",
    html: `<h2>Bonjour {{destinataire}},</h2>
<p>Nous avons bien reçu la demande de réservation <strong>{{reference}}</strong>. Elle sera confirmée par notre équipe dans les plus brefs délais.</p>
<ul>
<li>Voiture : {{marque}} {{modele}} ({{annee}}), {{carrosserie}}, {{transmission}}</li>
<li>Dates : du {{date_debut}} au {{date_fin}} ({{jours}} jours)</li>
<li>Départ : {{agence_depart}} · Retour : {{agence_retour}}</li>
<li>Prix par jour : {{prix_jour}} · Options : {{options}}</li>
<li>Remise : {{remise}} {{code_promo}}</li>
<li><strong>Total : {{total}}</strong> (caution : {{caution}})</li>
</ul>
<p>Conducteur : {{client_nom}}, {{client_telephone}}</p>
<p>{{bouton_reservation}}</p>
<p>Merci de votre confiance,<br>L'équipe {{site}}</p>`,
  },
};

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
