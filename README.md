# Dizy Cars — Location de voitures

Site de location de voitures au Maroc : pages publiques, espace réservation client, espace gestionnaire et espace administrateur, en 9 langues (Darija, arabe, français, anglais, espagnol, allemand, japonais, chinois, coréen).

**Stack** : Next.js 16 (App Router, TypeScript) · PostgreSQL sur **Neon** (Drizzle ORM, modèle 100 % relationnel) · Auth.js v5 · **Resend** (emails) · **Cloudinary** (photos et pièces d'identité) · **Netlify** (hébergement) · next-intl (traductions, RTL).

---

## Fonctionnalités

| Espace | Contenu |
| --- | --- |
| Public | Accueil, catalogue filtrable (ville, dates, catégorie, boîte, carburant, places, prix), fiche voiture avec disponibilité, agences, à propos |
| Client | Connexion Google, Facebook, X, TikTok, Instagram ou email · réservation avec options et calcul du prix · suivi et annulation |
| Gestionnaire | Tableau de bord du jour · parc automobile · réservations (confirmer, refuser, remise des clés, retour) |
| Administrateur | Tout l'espace gestionnaire + **gestion des gestionnaires** : fiche complète, pièces CINE/permis privées, désactivation avec motif (jamais de suppression), statistiques jour/semaine/mois/année avec graphiques, tableau recherche globale + par colonne, tri, pagination 25/50/100, colonnes affichables mémorisées par utilisateur, export du tableau et de chaque fiche en PDF, CSV, DOC, PPT, JSON, XML, TXT |

### Règles garanties par la base de données
Même en cas de bug applicatif ou d'accès direct à la base :
- `DELETE` interdit sur `managers`, `cars` et `reservations` (trigger) → on désactive seulement.
- Une voiture désactivée est **figée** : aucun `UPDATE` possible, ni sur ses photos ni sur ses descriptions (triggers).
- Pas de double réservation : contrainte d'exclusion `btree_gist` sur la période d'une même voiture.
- On ne peut pas réserver une voiture désactivée ; elle n'apparaît plus sur le site public.
- Désactivation d'un gestionnaire : motif obligatoire (contrainte `CHECK`), son compte ne peut plus se connecter.

---

## Démarrage local

```bash
npm install
cp .env.example .env.local      # puis remplir DATABASE_URL au minimum
cp .env.local .env              # drizzle-kit et le script de seed lisent .env
rm -rf .env.example
npm run db:migrate              # crée les tables, triggers et contraintes
npm run db:seed -- --demo       # agences, options, codes promo, admin + jeu de démonstration
npm run dev
```

Comptes de démonstration (`--demo`) :

| Rôle | Email | Mot de passe |
| --- | --- | --- |
| Administrateur | `SEED_ADMIN_EMAIL` | `SEED_ADMIN_PASSWORD` |
| Gestionnaire | youssef@dizy-cars.com | Gestion2026! |
| Client | client@dizy-cars.com | Client2026! |

Sans Cloudinary en développement, les fichiers sont gardés dans `.uploads/` (ignoré par Git). En production, Cloudinary est obligatoire.

Scripts utiles : `npm run typecheck`, `npm run lint`, `npm run i18n:check` (vérifie que les 9 langues ont les mêmes clés), `npm run db:studio`.

---

## Mise en production

### 1. Neon (PostgreSQL)
1. Créez un projet sur neon.tech (région Europe, proche du Maroc).
2. Copiez la chaîne **pooled** (hôte contenant `-pooler`) dans `DATABASE_URL` et la chaîne **directe** dans `DATABASE_URL_UNPOOLED`.
3. Depuis votre poste : `npm run db:migrate` puis `npm run db:seed` (sans `--demo` en production).
   Le seed lit `.env` **et** `.env.local`. Relancé, il remet le compte `SEED_ADMIN_EMAIL` actif avec le mot de passe `SEED_ADMIN_PASSWORD` : c'est la marche à suivre si la connexion administrateur échoue.

### 2. Cloudinary
Copiez `Cloud name`, `API key`, `API secret` dans `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` et `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.
Les pièces d'identité sont envoyées en mode `authenticated` (dossier `dizycars/identity`) : elles ne sont jamais accessibles publiquement, l'administrateur les ouvre via un lien signé valable 10 minutes.

### 3. Resend
Vérifiez votre domaine sur resend.com, puis renseignez `RESEND_API_KEY` et `EMAIL_FROM` (ex. `Dizy Cars <reservations@votre-domaine.ma>`).
Emails envoyés dans la langue du destinataire : invitation des gestionnaires, réinitialisation de mot de passe, demande reçue, confirmation, refus, annulation.

### 4. Connexions sociales
Pour chaque fournisseur, l'URL de rappel est `https://VOTRE-DOMAINE/api/auth/callback/<id>` :

| Fournisseur | `<id>` | Variables | Console |
| --- | --- | --- | --- |
| Google (Gmail) | `google` | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | console.cloud.google.com → Identifiants OAuth |
| Facebook | `facebook` | `AUTH_FACEBOOK_ID`, `AUTH_FACEBOOK_SECRET` | developers.facebook.com → Facebook Login |
| X (Twitter) | `twitter` | `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET` | developer.x.com → OAuth 2.0 |
| TikTok | `tiktok` | `AUTH_TIKTOK_ID` (client key), `AUTH_TIKTOK_SECRET` | developers.tiktok.com → Login Kit |
| Instagram | `instagram` | `AUTH_INSTAGRAM_ID`, `AUTH_INSTAGRAM_SECRET` | developers.facebook.com → Instagram API with Instagram Login |

Un bouton reste grisé tant que ses variables ne sont pas renseignées.
⚠️ Meta a fermé l'ancienne API Instagram Basic Display fin 2024 : la connexion Instagram ne fonctionne qu'avec des comptes **professionnels ou créateurs**. X, TikTok et Instagram ne transmettent pas l'email : le client le saisit au moment de réserver si besoin.
Les comptes de l'équipe (administrateur, gestionnaires) se connectent uniquement par email et mot de passe.

### 5. Netlify
1. « Add new site » → « Import from Git » → choisissez ce dépôt privé.
2. Netlify détecte Next.js (`netlify.toml` fourni, Node 22).
3. Ajoutez toutes les variables de `.env.example` dans *Site configuration → Environment variables*, avec `AUTH_URL` et `NEXT_PUBLIC_APP_URL` = votre domaine, et `AUTH_SECRET` généré par `openssl rand -base64 32`.
4. Déployez.

---

## Sécurité des connexions

- **Règles réglables** dans Administration → Sécurité : essais avant blocage d'un compte (5 par défaut), durée du blocage (15 min), essais par adresse IP (20), durée de session de l'équipe (12 h) et des clients (14 jours, 90 au maximum).
- **Comptes bloqués** : colonne `users.login_locked_until` (vide = non bloqué). L'administrateur les débloque depuis Sécurité ou depuis la fiche du gestionnaire.
- **Double authentification de l'administrateur** : Administration → Sécurité. Code à 6 chiffres (Google Authenticator, Microsoft Authenticator…) et 8 codes de secours à usage unique.
- **Téléphone et codes de secours perdus** : `npm run db:seed -- --reset-2fa` désactive la double authentification de `SEED_ADMIN_EMAIL` et lève son blocage.
- Les secrets de double authentification sont chiffrés avec une clé dérivée d'`AUTH_SECRET`. **Changer `AUTH_SECRET` les rend illisibles** : lancer alors `--reset-2fa` puis réactiver la protection.

## Emails automatiques

Modifiables dans **Administration** (éditeur HTML, variables `{{prenom}}`, `{{marque}}`…, aperçu, email de test) :

| Modèle | Quand | Destinataires |
|---|---|---|
| Invitation gestionnaire | création d'un gestionnaire, renvoi d'invitation | le gestionnaire |
| Ajout d'une voiture | ajout au parc | administrateur(s) et tous les gestionnaires actifs |
| Réservation d'une voiture | nouvelle réservation | client, administrateur(s), gestionnaires associés à la voiture (tous si aucun) |

Sans `RESEND_API_KEY`, rien n'est envoyé : le terminal affiche chaque destinataire.

## Structure

```
drizzle/                    migrations SQL (dont 0001_integrity_rules.sql : triggers et contraintes)
scripts/check-i18n.mjs      contrôle des traductions
src/
  app/[locale]/(site)/      pages publiques, connexion, réservation, espace client
  app/[locale]/admin/       espace administrateur (gestionnaires, parc, réservations)
  app/[locale]/manager/     espace gestionnaire
  auth.ts                   Auth.js : fournisseurs, rôles, comptes désactivés
  db/schema.ts              schéma relationnel PostgreSQL
  features/                 écrans partagés admin/gestionnaire (parc, réservations, tableau de bord)
  components/data-table/    tableau : recherche, filtres par colonne, tri, pagination, colonnes mémorisées, exports
  lib/export.ts             exports PDF, CSV, DOCX, PPTX, JSON, XML, TXT
  messages/*.json           traductions (fr, ary, ar, en, es, de, ja, zh, ko)
  server/                   actions serveur, requêtes, emails, Cloudinary
  proxy.ts                  préfixe de langue (Next.js 16 : « proxy » remplace « middleware »)
```

### Modèle de données
`users` · `accounts` · `sessions` · `verification_tokens` · `password_tokens` · `agencies` · `managers` · `manager_documents` · `manager_events` (historique : création, modifications, désactivations avec motif) · `cars` · `car_images` · `car_translations` · `extras` · `reservations` · `reservation_extras` · `table_preferences` (colonnes visibles et taille de page par utilisateur) · `audit_logs`.

Statistiques des gestionnaires : une « voiture louée » est une réservation confirmée par ce gestionnaire (statut confirmée, en cours ou terminée), comptée à sa date de confirmation, en heure du Maroc ; la semaine commence le lundi.
