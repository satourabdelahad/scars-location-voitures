/**
 * Contrat de location : variables disponibles dans l'en-tête et le corps (HTML), remplacées à la génération.
 * Une variable s'écrit {nom}. Les valeurs sont échappées ; seules {company_logo_img} et {client_signature_img}
 * insèrent une image.
 */
export const CONTRACT_VARIABLES = {
  company: ["company_address", "company_phone", "company_email", "company_whatsapp", "agency_name", "agency_address", "agency_phone"],
  client: [
    "client_civility",
    "client_last_name",
    "client_first_name",
    "client_full_name",
    "client_phone",
    "client_email",
    "client_city",
    "client_birth_date",
    "client_license_number",
    "client_license_expires_on",
  ],
  car: ["car_brand", "car_model", "car_year", "car_plate", "car_color", "car_vin", "car_fuel", "car_transmission", "car_category"],
  rental: [
    "reservation_reference",
    "start_date",
    "end_date",
    "days",
    "pickup_agency",
    "return_agency",
    "daily_price",
    "extras",
    "extras_total",
    "discount",
    "total_price",
    "deposit",
  ],
  inspection: ["departure_mileage", "departure_fuel", "departure_damages", "return_mileage", "return_fuel", "return_damages", "client_signature_img"],
  other: ["today", "company_logo_img"],
} as const;

export type ContractVariable = (typeof CONTRACT_VARIABLES)[keyof typeof CONTRACT_VARIABLES][number];
export const ALL_CONTRACT_VARIABLES = Object.values(CONTRACT_VARIABLES).flat() as ContractVariable[];
const RAW_HTML: ContractVariable[] = ["client_signature_img", "company_logo_img"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Retire scripts, gestionnaires d'événements et liens javascript: (le modèle vient de l'administrateur, on reste prudent). */
export function sanitizeHtml(html: string) {
  return html
    .replace(/<\s*(script|iframe|object|embed|style|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|link|meta)[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

/** Remplace les variables ; une variable inconnue reste visible pour être corrigée. */
export function fillContract(html: string, values: Partial<Record<ContractVariable, string>>) {
  return sanitizeHtml(html).replace(/\{([a-z_]+)\}/g, (m, key: string) => {
    if (!(ALL_CONTRACT_VARIABLES as string[]).includes(key)) return m;
    const v = values[key as ContractVariable] ?? "";
    return RAW_HTML.includes(key as ContractVariable) ? v : esc(v);
  });
}

/** Valeurs d'exemple pour l'aperçu dans l'éditeur. */
export const SAMPLE_VALUES: Partial<Record<ContractVariable, string>> = {
  company_address: "12 avenue Hassan II, Témara",
  company_phone: "+212 5 37 00 00 00",
  company_email: "contact@exemple.ma",
  company_whatsapp: "+212 6 00 00 00 00",
  agency_name: "Agence Centre",
  agency_address: "12 avenue Hassan II, Témara",
  agency_phone: "+212 5 37 00 00 00",
  client_civility: "M.",
  client_last_name: "Alaoui",
  client_first_name: "Youssef",
  client_full_name: "Youssef Alaoui",
  client_phone: "+212 6 11 22 33 44",
  client_email: "youssef@example.com",
  client_city: "Rabat",
  client_birth_date: "12/04/1990",
  client_license_number: "AB123456",
  client_license_expires_on: "30/06/2031",
  car_brand: "Dacia",
  car_model: "Logan",
  car_year: "2024",
  car_plate: "12345-A-6",
  car_color: "Blanc",
  car_vin: "UU1LSDAAH12345678",
  car_fuel: "Diesel",
  car_transmission: "Manuelle",
  car_category: "Économique",
  reservation_reference: "DZ-24A7K",
  start_date: "12/11/2026",
  end_date: "15/11/2026",
  days: "3",
  pickup_agency: "Agence Centre, Témara",
  return_agency: "Aéroport Rabat-Salé",
  daily_price: "300,00 MAD",
  extras: "Siège bébé",
  extras_total: "60,00 MAD",
  discount: "0,00 MAD",
  total_price: "960,00 MAD",
  deposit: "5 000,00 MAD",
  departure_mileage: "45 210 km",
  departure_fuel: "8/8",
  departure_damages: "Rayure pare-choc arrière",
  return_mileage: "",
  return_fuel: "",
  return_damages: "",
  client_signature_img: "",
  today: "12/11/2026",
  company_logo_img: "",
};

export const DEFAULT_CONTRACT_HEADER = `<table style="width:100%;border-collapse:collapse">
  <tr>
    <td style="width:50%;vertical-align:top">{company_logo_img}<div style="font-size:20px;font-weight:800;margin-top:6px">Votre société</div>
      <div style="font-size:12px;color:#555">{company_address}<br>Tél. {company_phone} · {company_email}<br>RC … · ICE … · IF …</div></td>
    <td style="width:50%;vertical-align:top;text-align:right">
      <div style="font-size:18px;font-weight:800">CONTRAT DE LOCATION</div>
      <div style="font-size:13px">N° {reservation_reference}</div>
      <div style="font-size:12px;color:#555">Établi le {today}</div></td>
  </tr>
</table>`;

export const DEFAULT_CONTRACT_BODY = `<h2>1. Le locataire</h2>
<table class="grid">
  <tr><th>Nom et prénom</th><td>{client_civility} {client_last_name} {client_first_name}</td><th>Téléphone</th><td>{client_phone}</td></tr>
  <tr><th>Email</th><td>{client_email}</td><th>Ville</th><td>{client_city}</td></tr>
  <tr><th>Date de naissance</th><td>{client_birth_date}</td><th>Permis n°</th><td>{client_license_number} (valable jusqu'au {client_license_expires_on})</td></tr>
</table>

<h2>2. Le véhicule</h2>
<table class="grid">
  <tr><th>Marque et modèle</th><td>{car_brand} {car_model} ({car_year})</td><th>Immatriculation</th><td>{car_plate}</td></tr>
  <tr><th>Couleur</th><td>{car_color}</td><th>Carburant / boîte</th><td>{car_fuel} · {car_transmission}</td></tr>
</table>

<h2>3. La location</h2>
<table class="grid">
  <tr><th>Départ</th><td>{start_date} · {pickup_agency}</td><th>Retour</th><td>{end_date} · {return_agency}</td></tr>
  <tr><th>Durée</th><td>{days} jour(s) à {daily_price}</td><th>Options</th><td>{extras} ({extras_total})</td></tr>
  <tr><th>Remise</th><td>{discount}</td><th>Total</th><td><strong>{total_price}</strong></td></tr>
  <tr><th>Caution</th><td colspan="3">{deposit}</td></tr>
</table>

<h2>4. État du véhicule</h2>
<table class="grid">
  <tr><th>Kilométrage au départ</th><td>{departure_mileage}</td><th>Carburant au départ</th><td>{departure_fuel}</td></tr>
  <tr><th>Dégâts constatés au départ</th><td colspan="3">{departure_damages}</td></tr>
  <tr><th>Kilométrage au retour</th><td>{return_mileage}</td><th>Carburant au retour</th><td>{return_fuel}</td></tr>
  <tr><th>Dégâts constatés au retour</th><td colspan="3">{return_damages}</td></tr>
</table>

<h2>5. Conditions</h2>
<ol>
  <li>Le locataire doit être titulaire d'un permis de conduire valide depuis au moins deux ans.</li>
  <li>Le véhicule est rendu avec le même niveau de carburant qu'au départ ; à défaut, le complément est facturé.</li>
  <li>Toute infraction au code de la route pendant la location est à la charge du locataire.</li>
  <li>En cas d'accident ou de panne, le locataire prévient immédiatement l'agence.</li>
  <li>Tout retard non signalé peut être facturé comme une journée supplémentaire.</li>
  <li>La caution est restituée au retour du véhicule, après vérification de son état.</li>
</ol>

<table style="width:100%;margin-top:32px">
  <tr>
    <td style="width:50%;vertical-align:top">Signature du loueur<br><br><br></td>
    <td style="width:50%;vertical-align:top">Signature du locataire (lu et approuvé)<br>{client_signature_img}</td>
  </tr>
</table>`;

/** Styles appliqués au contrat (écran et impression). */
export const CONTRACT_CSS = `
.contract{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;line-height:1.45}
.contract h1,.contract h2{font-size:15px;margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid #ddd}
.contract table.grid{width:100%;border-collapse:collapse}
.contract table.grid th,.contract table.grid td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
.contract table.grid th{background:#f6f6f6;font-weight:600;width:18%}
.contract img{max-width:100%}
.contract ol{padding-left:20px;list-style:decimal}
.contract ul{padding-left:20px;list-style:disc}
.contract p{margin:6px 0}
.contract hr{margin:12px 0;border-color:#ddd}
`;
