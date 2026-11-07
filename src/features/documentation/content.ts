/**
 * Documentation fonctionnelle de l'application (menu « Documentation » du back-office).
 * Format du texte : « ### » intertitre, « - » liste, ligne vide = nouveau paragraphe, **gras**.
 * adminOnly : section affichée seulement à l'administrateur.
 */
export type DocSection = { id: string; title: string; adminOnly?: boolean; body: string };

export const DOC: DocSection[] = [
  {
    id: "presentation",
    title: "Vue d'ensemble",
    body: `Dizy Cars est un site de location de voitures au Maroc. Il réunit un **site public**, où les clients découvrent les voitures et réservent, et un **back-office**, où l'équipe gère les agences, le parc, les réservations, les clients et la communication.

### Les trois profils
- **Client** : il consulte le site, réserve une voiture et suit ses réservations depuis son espace.
- **Gestionnaire** : membre de l'équipe. Il gère les voitures, les réservations, les clients et les prospects de son périmètre.
- **Administrateur** : il a accès à tout. Il crée les agences et les gestionnaires, règle le site public, les modèles d'email et la sécurité.

### Neuf langues
Toute l'application existe en français, darija, arabe, anglais, espagnol, allemand, japonais, chinois et coréen. La langue se choisit en haut à droite avec le drapeau. L'arabe et la darija s'affichent de droite à gauche. Les emails partent dans la langue du destinataire.

### Rien n'est supprimé
Une agence, une voiture, un gestionnaire ou une réservation ne se suppriment jamais : on les **désactive**, avec un motif quand il est demandé. L'historique reste donc complet, et la base de données l'interdit elle-même, même en cas d'erreur.

### Le bandeau du haut
Le bandeau noir en haut de chaque page, sur le site comme dans le back-office, rappelle l'ouverture 24h/24 et 7j/7, la phrase de livraison gratuite, les réseaux sociaux, l'email, le téléphone et le WhatsApp. Son contenu se règle dans **Site public**.`,
  },
  {
    id: "public",
    title: "Le site public",
    body: `### Menu
Le menu propose **Nos voitures**, **Réservation**, **Nos agences**, **À propos** et **Contact**. « Nos agences » n'apparaît que s'il y a au moins deux agences actives ; avec une seule agence, ses coordonnées sont reprises dans Contact.

### Accueil
La recherche demande le **lieu de prise en charge** (liste des agences, avec leur adresse), la **date de départ** et la **date de retour**, obligatoires, et les **heures**, facultatives. Aucune connexion n'est nécessaire. Plus bas, les voitures sont regroupées par type de carrosserie, par ville ou par agence.

### Nos voitures
Le catalogue se filtre par ville, dates, catégorie, boîte, carburant, nombre de places et prix. La fiche d'une voiture affiche ses photos, ses caractéristiques, son prix par jour, une éventuelle promotion et ses disponibilités.

### Résultats de la recherche
La page Réservation affiche le **nombre de voitures disponibles** sur la période, un tri par **prix** ou par **nom**, et pour chaque voiture le prix total, le prix par jour et deux boutons : **Afficher tous les détails** et **Réserver cette voiture**.

### Réserver une voiture
La page de réservation reprend tous les détails de la voiture, puis :
- le lieu, les dates et les heures ;
- **Besoin d'un chauffeur (Oui / Non)**, au prix par jour réglé dans Suppléments (ou sur devis) ;
- les **suppléments** (GPS, siège enfant, siège bébé, assistance…), facturés par jour ou une seule fois ;
- le récapitulatif : location, chauffeur, suppléments, code promo, **dépôt de garantie** et **somme totale** ;
- la case **J'accepte les conditions générales**, avec un lien qui les affiche dans une fenêtre. Les conditions précisent que le client est inscrit automatiquement à la newsletter.

Au clic sur **Réserver**, le visiteur non connecté choisit :
- un **réseau social** (Google, Facebook, X, TikTok, Instagram) ; à son retour, il complète son numéro de carte d'identité et de permis ;
- **J'ai un compte** : email et mot de passe ;
- **Nouveau client** : civilité, nom, prénom, ville, téléphone (case « c'est mon WhatsApp », sinon un champ WhatsApp facultatif), numéro de carte d'identité, numéro de permis et email facultatif.

Un nouveau client est connecté automatiquement et arrive sur le **récapitulatif** de sa réservation, avec le message « demande prise en compte, réponse sous 1 heure maximum » (délai réglable). La réservation commence **en attente** : l'administrateur et les responsables de l'agence et de la voiture reçoivent un email avec les boutons **Accepter** et **Refuser**.

### Pages d'information
**À propos** (qui nous sommes, mission, vision, services), **Contact** (adresse, carte, email, téléphone, WhatsApp, réseaux sociaux et formulaire), **Conditions de location** et **Confidentialité**. Tous ces textes se modifient dans Site public, langue par langue.

### Protection anti-robot
La connexion, l'inscription, le mot de passe oublié, la réservation et le formulaire de contact sont protégés par reCAPTCHA v3, invisible pour le visiteur.`,
  },
  {
    id: "client-space",
    title: "L'espace client",
    body: `L'espace client ressemble à la fiche d'un gestionnaire, avec trois onglets :
- **Informations** : identité, téléphone, WhatsApp, ville, carte d'identité, permis ;
- **Réservations** : toutes ses locations ;
- **Historique** : réservations, confirmations, départs, retours, prolongations, documents déposés.

### Le récapitulatif d'une réservation
Tous les détails (agences, dates et heures, chauffeur, suppléments, total, caution) avec les boutons **Imprimer**, **Télécharger en PDF**, **Annuler** (tant que c'est possible) et **Prolonger**. Une prolongation est une **demande** : l'équipe qui valide reçoit un email avec Accepter / Refuser, puis le client reçoit la réponse par email. Le client y dépose aussi son **permis** et sa **carte d'identité**, recto et verso ; ces documents sont privés et visibles par l'équipe dans la réservation.

Un client ajouté par l'équipe avec un email reçoit une invitation : il choisit son mot de passe puis complète son profil.`,
  },
  {
    id: "backoffice",
    title: "Le back-office",
    body: `Le menu de gauche donne accès au **Tableau de bord**, à **Mes agences**, aux **Gestionnaires**, au **Parc automobile**, aux **Clients**, aux **Réservations**, à l'**Email Marketing** et à cette **Documentation**. L'administrateur a en plus **Site public**, **Templates des emails** et **Sécurité** ; le gestionnaire a **Mon profil**. En haut à droite : thème clair ou sombre, menu du compte (historique, mes voitures, déconnexion) et langue.

### Les tableaux
Tous les tableaux fonctionnent de la même façon :
- recherche globale et filtre par colonne (texte, liste ou liste avec saisie, comme la ville) ;
- tri en cliquant sur l'en-tête ;
- choix des colonnes affichées et du nombre de lignes, mémorisés pour chaque utilisateur ;
- **sélection multiple** avec les cases à cocher, puis **actions groupées** sur les lignes cochées ;
- **export** de ce qui est affiché en PDF, CSV, Word, PowerPoint, JSON, XML ou texte.

### Tableau de bord
Les départs et retours du jour, les réservations en attente et les chiffres clés.`,
  },
  {
    id: "agencies",
    title: "Les agences",
    body: `**Mes agences** liste toutes les agences, actives et désactivées. On y retrouve la ville, l'adresse, le téléphone, le WhatsApp, les **responsables** (photo, civilité, nom et prénom, téléphone et email, chaque nom menant à la fiche du gestionnaire), le nombre de voitures et le statut.

### Actions groupées (administrateur)
Cochez des agences pour les **désactiver** (motif obligatoire) ou les **réactiver**. Une agence qui a encore des voitures en service ne peut pas être désactivée : déplacez ou désactivez d'abord ses voitures.

### La fiche d'une agence
- **Statistiques** : voitures, voitures en location, en réparation, gestionnaires, locations et chiffre d'affaires (total et 30 derniers jours).
- **Informations** : nom, ville, adresse, téléphone, WhatsApp, agence d'aéroport, site web et réseaux sociaux (Facebook, Instagram, LinkedIn, X, TikTok). C'est aussi là qu'on la désactive ou la réactive.
- **Responsables** : 0, 1 ou plusieurs gestionnaires. Les responsables valident les réservations au départ de l'agence et en sont automatiquement membres.
- **Gestionnaires** : les gestionnaires rattachés à l'agence. Les responsables et l'administrateur en font toujours partie.
- **Voitures** : entre parenthèses, le nombre de voitures affectées à l'agence.

### Affecter des responsables et des gestionnaires
Les onglets Responsables et Gestionnaires fonctionnent de la même façon. « Tous » affiche toute l'équipe, « Affectés » seulement les personnes cochées. Une recherche filtre par nom, téléphone ou email. Cochez ou décochez, puis **Enregistrer**. Le bouton **Exporter** produit la liste des affectés en PDF, Word, CSV… Un gestionnaire nouvellement rattaché est annoncé par email à l'équipe de l'agence.

### Affecter des voitures
L'onglet Voitures affiche **Affectées** (agence principale ou agence supplémentaire) ou **Toutes**. Cochez des voitures puis **Affecter à l'agence** ou **Retirer de l'agence**. On ne retire pas ici une voiture de son agence principale : on change l'agence principale dans la fiche de la voiture. Les autres actions groupées du parc sont aussi disponibles, ainsi que l'export.

### Une seule agence
Avec une seule agence active, le site public masque « Nos agences » et affiche ses coordonnées dans Contact.`,
  },
  {
    id: "managers",
    title: "Les gestionnaires",
    body: `### Créer un gestionnaire (administrateur)
La fiche comprend l'identité, le contact, la ville, le contrat (CDI, CDD ou Freelance), la photo et les pièces d'identité (CINE, permis), conservées de façon privée. Le gestionnaire reçoit une **invitation** par email : il reste « Invitation en attente » jusqu'à ce qu'il choisisse son mot de passe.

### La liste
Recherche, filtres, export et actions groupées : désactiver (avec motif), réactiver, renvoyer l'invitation. L'administrateur apparaît aussi dans la liste ; il ne peut être ni désactivé ni invité.

### La fiche d'un gestionnaire
Statistiques, informations, **Agences** (celles dont il est membre ou responsable), **Périmètre** (règle d'affectation automatique des voitures), voitures affectées, deals, rendez-vous, réalisations et historique.

### Le périmètre d'action
Un gestionnaire rattaché à une ou plusieurs agences n'agit que sur les voitures de ces agences, qu'il s'agisse de l'agence principale de la voiture ou d'une agence supplémentaire. Cela vaut pour l'ajout et la modification d'une voiture, la réparation, la désactivation, les promotions, les actions groupées, les deals et les réservations. Son parc n'affiche que ces voitures. S'il ouvre une voiture hors de son périmètre, un bandeau indique qu'il peut la consulter mais pas la modifier.

Un gestionnaire rattaché à aucune agence, et l'administrateur, ne sont pas limités.

### L'administrateur
Le super administrateur est l'adresse définie dans la variable SEED_ADMIN_EMAIL. S'il n'existe pas, il est créé au démarrage de l'application ; à la première connexion, il passe par « Mot de passe oublié ». Il appartient à toutes les agences.`,
  },
  {
    id: "fleet",
    title: "Le parc automobile",
    body: `### La fiche d'une voiture
- **Informations** : marque, modèle, année, catégorie, boîte, carburant, places, couleur, immatriculation, kilométrage, achat (ville, date, prix).
- **Tarifs** : prix par jour et caution.
- **Promotion** : un pourcentage, avec ou sans dates de début et de fin.
- **Photos** : une photo principale obligatoire, puis avant, arrière, côtés, intérieur… une photo par vue.
- **Descriptions** : un texte par langue.
- **Agence** : l'**agence principale**, obligatoire (lieu de prise en charge affiché sur le site), et des **agences supplémentaires**, de 0 à plusieurs, qui partagent la gestion de la voiture.
- **Gestionnaires** : les gestionnaires qui suivent la voiture (aucun coché = tous), et les **responsables de la voiture**, de 0 à plusieurs, qui valident ses réservations.
- **Statistiques** et **Historique** des locations.

### États d'une voiture
Disponible, en location, en réparation ou désactivée. Une voiture **désactivée** (volée, vendue, accidentée…) disparaît du site, ses réservations à venir sont annulées avec un email au client, et ses données sont figées.

### Actions groupées
Cochez des voitures pour : désactiver, remettre en service, mettre en réparation, affecter à des gestionnaires (administrateur), changer d'agence principale ou appliquer une promotion.

### Affectation automatique
Dans la fiche d'un gestionnaire, une règle par marque, ville ou agence ajoute automatiquement les voitures correspondantes à sa liste, y compris les voitures créées plus tard.`,
  },
  {
    id: "car-file",
    title: "Le dossier d'une voiture",
    body: `La fiche d'une voiture a, en plus de ses informations, huit onglets de suivi.

### Assurance, vignette, vidange, visite technique
Chaque onglet affiche l'échéance en cours (à jour, bientôt, expirée) puis l'**historique**. **Ajouter** enregistre une nouvelle ligne : dates, montant, assureur ou garage, numéro de police ou de procès-verbal, et les **documents** (attestation d'assurance, carte grise, facture…), conservés en privé. Pour la vidange, on note aussi le kilométrage et la prochaine vidange en date et en kilomètres. Une saisie erronée s'**annule** : elle reste visible, barrée, et sort des calculs.

### États des lieux
Au départ et au retour de chaque location : kilométrage, niveau de carburant (en huitièmes), dégâts constatés, **photos** prises avec le téléphone et **signature du client** au doigt. Le kilométrage de la voiture se met à jour. Depuis une réservation, les boutons « État des lieux départ » et « État des lieux retour » ouvrent directement le bon formulaire.

### Rentabilité
Chiffre d'affaires des locations, toutes les dépenses (assurance, vignette, vidange, visite, entretien, réparations, pneus…), **marge réelle**, et ce qu'il reste à amortir sur le prix d'achat. Un graphique montre les 12 derniers mois. Les dépenses s'ajoutent en bas de l'onglet.

### Réservations
Tous les clients qui ont réservé la voiture : référence, client, dates, statut, total ; un clic ouvre la réservation.

### Planning
Le calendrier du mois de la voiture, avec ses réservations colorées selon leur état et son taux d'occupation.

### Le parc en calendrier
Dans **Parc automobile**, le bouton **Calendrier** affiche toutes les voitures du périmètre sur un mois : une ligne par voiture, une barre par réservation. Un clic sur une barre ouvre la réservation.`,
  },
  {
    id: "reservations",
    title: "Les réservations",
    body: `Une réservation passe par les étapes **en attente → confirmée → en cours → terminée**. Elle peut aussi être **refusée** ou **annulée**.

### Qui valide
Confirmer ou refuser une réservation est réservé à l'**administrateur**, aux **responsables de l'agence de départ** et aux **responsables de la voiture**. La fiche de la réservation affiche qui peut la valider. Les autres gestionnaires du périmètre enregistrent le départ et le retour.

### Emails
Le client reçoit un email à la confirmation, au refus et à l'annulation. L'administrateur et les responsables de l'agence et de la voiture reçoivent chaque nouvelle réservation avec deux boutons, **Accepter** et **Refuser**, qui ouvrent la réservation prête à être confirmée ou refusée.

### Demandes de prolongation
Les demandes du client apparaissent dans la réservation avec **Accepter** et **Refuser** (motif obligatoire). Acceptée, la location est prolongée et le prix recalculé ; dans les deux cas le client est prévenu par email.

### Détails et documents
La réservation affiche les heures de départ et de retour, le chauffeur, les suppléments et les documents déposés par le client (permis, carte d'identité).

### Remise des clés
Avant de remettre les clés, l'équipe **vérifie le permis** : numéro, date de validité (elle doit couvrir toute la location) et original présenté. Sans cette vérification, la location ne peut pas démarrer. La fiche de la réservation affiche « Permis vérifié ».

### Prolonger
Une location confirmée ou en cours se **prolonge** avec une nouvelle date de retour ; le prix est recalculé avec le même prix par jour et les mêmes options. La base refuse si la voiture est déjà réservée sur les jours ajoutés.

### Contrat PDF
Le bouton **Contrat PDF** ouvre le contrat de location rempli avec les données du client, de la voiture, de la location et des états des lieux, prêt à imprimer ou à enregistrer en PDF.

### Messages WhatsApp
Trois messages pré-remplis, dans la langue de la réservation : **confirmation**, **rappel la veille** et **retour**. Un clic ouvre WhatsApp avec le message prêt à envoyer au client.

### Remise des clés
Avant de remettre les clés, l'équipe **vérifie le permis** : numéro, date de validité (elle doit couvrir toute la location) et original présenté. Sans cette vérification, la location ne peut pas démarrer. La fiche de la réservation affiche « Permis vérifié ».

### Prolonger
Une location confirmée ou en cours se **prolonge** avec une nouvelle date de retour ; le prix est recalculé avec le même prix par jour et les mêmes options. La base refuse si la voiture est déjà réservée sur les jours ajoutés.

### Contrat PDF
Le bouton **Contrat PDF** ouvre le contrat de location rempli avec les données du client, de la voiture, de la location et des états des lieux, prêt à imprimer ou à enregistrer en PDF.

### Messages WhatsApp
Trois messages pré-remplis, dans la langue de la réservation : **confirmation**, **rappel la veille** et **retour**. Un clic ouvre WhatsApp avec le message prêt à envoyer au client.

### Garanties
Une même voiture ne peut pas être réservée deux fois sur la même période, et une voiture désactivée ne peut pas être réservée.`,
  },
  {
    id: "clients",
    title: "Clients, deals et rendez-vous",
    body: `### Clients
La liste des clients et leur fiche : informations, réservations, deals et rendez-vous. Un client ajouté avec un email reçoit une invitation. Cochez des clients pour les **activer** ou les **désactiver** (motif obligatoire), et exportez la liste (PDF, CSV, Word…).

### Liste noire
Cochez un ou plusieurs clients puis **Mettre sur liste noire**, avec un motif. Un client sur liste noire ne peut plus réserver, ses réservations ne peuvent plus être confirmées et les clés ne peuvent pas lui être remises. Sa fiche affiche un bandeau rouge avec le motif.

### Liste noire
Cochez un ou plusieurs clients puis **Mettre sur liste noire**, avec un motif. Un client sur liste noire ne peut plus réserver, ses réservations ne peuvent plus être confirmées et les clés ne peuvent pas lui être remises. Sa fiche affiche un bandeau rouge avec le motif.

### Deals (prospects)
Un deal est toujours lié à un client. Il précise le type de prospection, la source, la date et l'heure de l'échange, la voiture et le code promo éventuels, une note et la prochaine action. Le bouton **Envoyer au client** envoie le modèle « Suivi de prospection ». Un gestionnaire limité à des agences ne choisit que des voitures de son périmètre.

### Rendez-vous et réalisations
Les rendez-vous se planifient avec les clients ; les réalisations récapitulent l'activité de chaque gestionnaire.`,
  },
  {
    id: "header",
    title: "En haut à droite : alertes, notifications, équipe",
    body: `- **Alertes** (triangle) : voitures à nouveau disponibles, voitures en réparation, et échéances proches ou dépassées pour l'assurance, la vidange (en jours ou en kilomètres), la vignette et la visite technique. L'administrateur règle les délais avec **Régler**.
- **Notifications** (cloche) : les événements récents (nouvelle réservation, location démarrée, voiture à nouveau disponible, prolongation, nouveau gestionnaire, nouveau client en négociation, nouvelle voiture). Le chiffre rouge compte les non lues ; elles deviennent lues à la fermeture du menu.
- **Gestionnaires** : toute l'équipe avec son état de connexion, point vert pour les personnes en ligne, gris pour les autres.

Un gestionnaire limité à des agences ne voit que les alertes et notifications des voitures de son périmètre.`,
  },
  {
    id: "marketing",
    title: "Email Marketing",
    body: `Ciblez les clients par **ville** et par **nombre de jours de location**, puis envoyez un email de promotion. Chaque destinataire reçoit un **code promo personnel**, qui lui est attribué au moment où il clique sur le lien de l'email. Le code s'applique ensuite à sa réservation.`,
  },
  {
    id: "site",
    title: "Site public (réglages)",
    adminOnly: true,
    body: `- **Contact** : adresse principale, email, téléphone, WhatsApp, pages Facebook, Instagram, X et TikTok, et la phrase du bandeau du haut (par langue).
- **À propos** : qui nous sommes, mission, vision et services (un intertitre « ## » par service).
- **Conditions de location** et **Confidentialité**.

Chaque texte se règle langue par langue (drapeau à côté de chaque langue). Une langue laissée vide affiche le texte par défaut. Dans les textes, une ligne qui commence par « ## » devient un intertitre et une ligne qui commence par « - » un élément de liste.`,
  },
  {
    id: "emails",
    title: "Templates des emails",
    adminOnly: true,
    body: `Ces emails ont un modèle par langue, modifiable : invitation gestionnaire, invitation client, mot de passe défini par l'administrateur, nouvelle voiture, voiture associée à une agence, nouveau gestionnaire d'agence, nouvelle réservation, suivi de prospection et promotion (Email Marketing). Les variables entre accolades (prénom, agence, lien…) sont remplacées à l'envoi.

Les emails de confirmation, de refus et d'annulation de réservation, de mot de passe oublié et du formulaire de contact partent automatiquement, dans la langue du destinataire.`,
  },
  {
    id: "security",
    title: "Sécurité",
    adminOnly: true,
    body: `- Double authentification (application d'authentification et codes de secours) pour l'administrateur.
- Verrouillage temporaire d'un compte après plusieurs mots de passe erronés, avec la liste des comptes verrouillés.
- reCAPTCHA v3 sur les formulaires publics.
- Les comptes de l'équipe se connectent uniquement par email et mot de passe.
- Les pièces d'identité ne sont jamais publiques : elles s'ouvrent par un lien temporaire.
- Chaque action importante est enregistrée dans l'historique, avec son auteur.`,
  },
  {
    id: "history",
    title: "Historique",
    body: `Connexions, parc, réservations, clients, deals, agences et fiches : chaque événement est enregistré avec son auteur, son rôle et sa date, en frise ou en tableau. L'administrateur voit toute l'équipe ; un gestionnaire voit son activité. Les exports de tableaux sont aussi tracés.`,
  },
  {
    id: "operations",
    title: "Mise en ligne et maintenance",
    adminOnly: true,
    body: `- **Hébergement** : Netlify, relié au dépôt GitHub. Chaque envoi sur la branche main redéploie le site.
- **Base de données** : PostgreSQL (Neon). Après une mise à jour qui ajoute une migration, lancez npm run db:migrate depuis votre poste. Les migrations ne sont pas lancées pendant le déploiement.
- **Emails** : Resend, avec le domaine vérifié (enregistrements DNS chez OVH).
- **Photos** : Cloudinary.
- **reCAPTCHA** : variables RECAPTCHA_KEY et RECAPTCHA_SECRET, avec les domaines du site autorisés dans la console Google.
- Les clés et mots de passe restent dans .env.local et dans les variables de Netlify, jamais dans le dépôt.`,
  },
];
