import type { SitePage } from "./site-pages";

/**
 * Textes par défaut des pages du site public (français et anglais), à adapter dans
 * le back office (Site public). Les autres langues reprennent le français (arabe, darija)
 * ou l'anglais, tant qu'une traduction n'a pas été saisie.
 */
const FR: Record<SitePage, string> = {
  about_who: `Dizy Cars est une agence de location de voitures marocaine. Nous mettons à votre disposition des voitures récentes et bien entretenues, de la citadine au 4x4, avec un prix annoncé qui ne change pas au comptoir.

Notre équipe vous accueille en agence et à l'aéroport, et vous répond en français, en arabe, en darija, en anglais et en espagnol.`,
  about_history: `Dizy Cars est née d'une idée simple : louer une voiture au Maroc devrait être aussi simple que réserver un billet d'avion. Pas de frais cachés, pas de surprise à la remise des clés.

Partie d'une seule agence, l'entreprise grandit avec ses clients, voyageurs de passage comme habitués, qui reviennent et nous recommandent.`,
  about_mission: `Rendre la location de voiture simple, transparente et sûre :
- un prix clair, affiché dès la recherche ;
- des voitures propres, révisées et assurées ;
- une confirmation rapide et une assistance 24h/24 pendant la location.`,
  about_vision: `Devenir la référence de la location de voitures au Maroc pour la qualité du service, en accompagnant chaque client de la réservation au retour de la voiture, partout dans le pays.`,
  terms: `## Conducteur
- Âge minimum : 21 ans, avec un permis de conduire valide.
- Le permis et une pièce d'identité sont présentés à l'agence au départ.
- Un conducteur supplémentaire peut être ajouté en option.

## Réservation et confirmation
La réservation devient définitive après sa validation par l'agence. Vous recevez alors une confirmation par email ou par téléphone.

## Paiement et caution
- Le paiement se fait à la remise des clés.
- Une caution est bloquée par carte bancaire au départ ; son montant est indiqué sur la fiche de la voiture. Elle est libérée au retour, après vérification de la voiture.

## Annulation
L'annulation est gratuite jusqu'à 48 heures avant le départ. Contactez l'agence pour toute modification.

## Utilisation de la voiture
- Kilométrage illimité.
- La voiture est rendue avec le même niveau de carburant qu'au départ.
- Il est interdit de fumer dans la voiture et de la sous-louer.
- Toute sortie du territoire marocain doit être autorisée par écrit par l'agence.

## Assurance et assistance
Les voitures sont assurées. Une assurance tous risques sans franchise est proposée en option. En cas de panne ou d'accident, appelez l'assistance 24h/24 avant toute réparation.`,
  privacy: `## Données collectées
Lors d'une réservation ou d'un message, nous recueillons votre nom, votre prénom, votre ville, votre téléphone et, si vous la donnez, votre adresse email. Pour la location, les informations du conducteur (permis, date de naissance) peuvent être demandées.

## Utilisation
Ces données servent uniquement à gérer vos réservations, à vous contacter à leur sujet et, si vous l'acceptez, à vous envoyer nos offres. Elles ne sont jamais vendues.

## Conservation et sécurité
Les données sont conservées le temps nécessaire à la relation commerciale et aux obligations légales, sur des serveurs sécurisés. L'accès est réservé à notre équipe.

## Vos droits
Conformément à la loi marocaine n° 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel, vous disposez d'un droit d'accès, de rectification et d'opposition. Pour l'exercer, écrivez-nous via la page Contact.

## Cookies
Le site utilise des cookies nécessaires à son fonctionnement (connexion, langue, réservation). Aucun cookie publicitaire n'est déposé.`,
};

const EN: Record<SitePage, string> = {
  about_who: `Dizy Cars is a Moroccan car rental company. We offer recent, well-maintained cars, from city cars to 4x4s, at a price that does not change at the counter.

Our team welcomes you at our branches and at the airport, in French, Arabic, Darija, English and Spanish.`,
  about_history: `Dizy Cars started from a simple idea: renting a car in Morocco should be as easy as booking a flight. No hidden fees, no surprises when you collect the keys.

From a single branch, the company has grown with its clients, travellers and regulars alike, who come back and recommend us.`,
  about_mission: `Make car rental simple, transparent and safe:
- a clear price, shown from the first search;
- clean, serviced and insured cars;
- fast confirmation and 24/7 assistance during your rental.`,
  about_vision: `To become the reference for car rental in Morocco through the quality of our service, supporting each client from booking to return, everywhere in the country.`,
  terms: `## Driver
- Minimum age: 21, with a valid driving licence.
- The licence and an ID are shown at the branch at pick-up.
- An additional driver can be added as an option.

## Booking and confirmation
Your booking is final once validated by the branch. You then receive a confirmation by email or phone.

## Payment and deposit
- Payment is made when you collect the keys.
- A deposit is held on your bank card at pick-up; the amount is shown on the car page. It is released at return, after the car is checked.

## Cancellation
Cancellation is free up to 48 hours before pick-up. Contact the branch for any change.

## Using the car
- Unlimited mileage.
- Return the car with the same fuel level as at pick-up.
- Smoking and subletting are forbidden.
- Leaving Moroccan territory requires written permission from the branch.

## Insurance and assistance
All cars are insured. A zero-excess full insurance is available as an option. In case of breakdown or accident, call 24/7 assistance before any repair.`,
  privacy: `## Data we collect
When you book or send us a message, we collect your last name, first name, city, phone number and, if you provide it, your email address. Driver details (licence, date of birth) may be requested for the rental.

## How we use it
This data is only used to manage your bookings, contact you about them and, if you agree, send you our offers. It is never sold.

## Retention and security
Data is kept for as long as needed for our relationship and legal obligations, on secure servers. Access is restricted to our team.

## Your rights
Under Moroccan law 09-08 on the protection of individuals with regard to the processing of personal data, you have the right to access, correct and object. To exercise it, write to us from the Contact page.

## Cookies
The site uses cookies needed for it to work (sign-in, language, booking). No advertising cookies are set.`,
};

export function defaultPageText(page: SitePage, locale: string) {
  return locale === "fr" || locale === "ar" || locale === "ary" ? FR[page] : EN[page];
}
