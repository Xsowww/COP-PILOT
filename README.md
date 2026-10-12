# COP-PILOT

Hub de productivité pour étudiants : **Drive**, **Calendrier** et **Notes** réunis dans une seule appli, avec **Copilot**, un petit robot qui se cache sur le bord de l'écran et aide l'étudiant à s'organiser.

## Démarrer

```bash
npm install
cp .env.example .env   # puis colle ta clé API Anthropic dans ANTHROPIC_API_KEY
npm run dev            # http://localhost:5173
```

En production :

```bash
npm run build
npm start              # sert l'appli + l'API de Copilot sur http://localhost:3000
```

Node 20.12+ (voir `.nvmrc`). Un devcontainer est fourni pour GitHub Codespaces.

## Ce que contient l'appli

| Espace | Fonctionnalités |
| --- | --- |
| **Connexion / inscription** | Comptes multiples sur le même navigateur, mot de passe haché (PBKDF2), chaque compte a ses propres données. Un nouveau compte reçoit quelques éléments de départ. |
| **Dashboard** | Widgets : programme du jour, prochain examen (J-x, bouton « Planifier les révisions »), semaine (nombre de tâches à faire, progression et charge par jour), à venir, notes récentes, Drive (espace utilisé, fichiers récents), actions rapides. |
| **Drive** | Importer des fichiers ou un dossier entier (bouton ou glisser-déposer depuis l'ordinateur), créer, renommer (F2), supprimer, copier / couper / coller (Ctrl+C / X / V), dupliquer (Ctrl+D), déplacer par glisser-déposer ou via « Déplacer vers… », Alt+glisser pour copier, sélection multiple (Ctrl / Maj + clic, Ctrl+A), clic droit, favoris, récents, vue grille ou liste avec tri, aperçu (images, PDF, vidéo, audio, texte) et téléchargement. |
| **Calendrier** | Ajout en langage naturel (« Exam de maths vendredi 14h », « Sport demain 18h-19h »), catégorie devinée automatiquement (cours, examen, devoir, perso, sport), bande de la semaine et vue mois, agenda du jour avec cases « c'est fait », examens à venir avec J-x, devoirs à rendre, filtres par catégorie. |
| **Notes** | Dossiers et sous-dossiers, créer / renommer / dupliquer / épingler / supprimer, glisser une note ou un dossier dans un autre dossier, recherche, éditeur riche (titres, gras, surlignage, listes, cases à cocher, citations, code, liens), sauvegarde automatique. |
| **Profil et réglages** | En cliquant sur le profil en bas à gauche. Photo ou couleur d'avatar, établissement/filière/année (connus de Copilot), statistiques (série de jours, tâches, examens, sessions focus, notes, fichiers), couleur d'accent (6 choix, jusqu'au casque de Copilot), réduire les animations, réglages de Copilot (affichage, initiatives, rappels, bavardage, séances de révision), sessions focus (Pomodoro), raccourcis clavier, notifications du navigateur, export/import de sauvegarde, export du calendrier en .ics, stockage utilisé, changement de mot de passe, double authentification (associer un autre téléphone), déconnexion, suppression du compte. |
| **Double authentification** | En mode en ligne, obligatoire pour chaque compte : à l'inscription, un QR code s'affiche ; on le scanne avec l'appareil photo (iPhone : Mots de passe) ou Google/Microsoft Authenticator, qui affiche un code à 6 chiffres à taper sur le site. Le code est redemandé à chaque connexion. La base elle-même refuse les données sans ce code (règles « 2fa obligatoire »). Téléphone perdu : Supabase › Authentication › Users › le compte › supprimer le facteur MFA, le QR code sera reproposé. |
| **Administration** | `/admin`, visible uniquement pour les comptes listés dans la table `admins` (et connectés avec leur code) : comptes, actifs, 2FA, stockage, notes, événements, fichiers, activité et inscriptions des 30 derniers jours, répartition du calendrier, liste des comptes avec recherche. Mise à jour en direct toutes les 20 s. Seulement des chiffres, jamais le contenu. Ajouter un admin : voir la fin de `supabase/schema.sql`. |
| **Session focus** | Minuteur Pomodoro en bas de la barre latérale : travail puis pause, son de fin, notification, Copilot te félicite. |
| **Copilot** | Personnage accroché au bord droit de l'écran, présent sur toutes les pages. Clic pour lui parler, glisser pour le déplacer le long du bord. Voir plus bas. |

Recherche globale dans la barre du haut (Ctrl+K) : fichiers, dossiers, notes et événements.

## Copilot

Petit personnage (casque de pilote) accroché au bord droit de l'écran : il suit la souris des yeux, cligne, passe la tête, s'endort si tu ne fais rien, et réagit selon la situation (content, surpris, qui réfléchit…).

**Il prend des initiatives** (`src/copilot/proactive.ts`) : salut à l'ouverture avec le programme du jour, examen ajouté → propose de planifier des révisions ou de créer une fiche, examen proche sans révisions, devoir à rendre demain, devoir en retard, événement qui commence dans 20 minutes, veille d'examen, journée terminée, premier import… Ses propositions ont de vrais boutons (« Planifier mes révisions » crée les créneaux et la fiche), et répondre « oui » suffit. Il ne se répète pas et laisse au moins 75 s entre deux remarques.

**Deux cerveaux :**
- **Avec une clé API** (`ANTHROPIC_API_KEY` dans `.env`) : Copilot passe par Claude via le serveur (`server/copilot.mjs`). Sa personnalité (meilleur pote, drôle mais sérieux quand il faut) et ses outils sont définis côté serveur : chercher, analyser le calendrier, créer/modifier des événements, planifier des révisions, créer/compléter des notes, créer des dossiers, ouvrir une page. Ses remarques spontanées sont aussi rédigées par Claude. La clé n'est jamais envoyée au navigateur.
- **Sans clé** : il comprend des commandes en français (« Trouve le dossier Maths », « Analyse ma semaine », « Planifie mes révisions », « Crée une note Révisions : chapitre 3 », « Ajoute Partiel de chimie dans 5 jours à 10h », « Raconte une blague »…). En cas de souci avec l'API, il bascule automatiquement sur ce mode.

## Base de données en ligne (Supabase)

**Déjà configuré** : le projet Supabase `cop-pilot` (Europe) est branché via `.env.supabase.public` (URL + clé *publishable*, faites pour être publiques ; la sécurité repose sur les règles de la base). Il suffit de lancer `npm run dev`. Pour repasser en mode local, supprime ce fichier ou vide ses valeurs dans `.env`.

Pour un nouveau projet Supabase :

Sans configuration, comptes et données restent dans le navigateur. Avec Supabase (gratuit), tout est en ligne et sécurisé : vrais comptes avec confirmation par e-mail et mot de passe oublié, données accessibles depuis n'importe quel appareil, fichiers du Drive dans un stockage privé, et chaque étudiant ne peut accéder qu'à ses propres données (Row Level Security).

1. Crée un compte sur [supabase.com](https://supabase.com), puis **New project** (région Europe : Paris ou Francfort).
2. **SQL Editor › New query** : colle le contenu de `supabase/schema.sql` et clique sur **Run**. Ça crée les tables, la sécurité (dont la double authentification), le stockage des fichiers, la suppression de compte et le tableau de bord admin. Les projets existants appliquent les fichiers de `supabase/migrations/`.
   Puis **Authentication › Multi-Factor** : laisse TOTP activé.
3. **Project Settings › API** : copie l'URL du projet et la clé `anon` / `publishable` dans `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. **Authentication › URL Configuration** : *Site URL* = l'adresse du site (`http://localhost:5173` en développement), et ajoute `http://localhost:5173/**` dans *Redirect URLs* (et l'adresse de production plus tard).
5. **Authentication › Providers › Email** : laisse « Confirm email » activé, mot de passe de 8 caractères minimum.
6. Relance `npm run dev`. Crée un compte, confirme l'e-mail, connecte-toi.

Comment ça marche : l'appli garde une copie locale pour rester instantanée ; chaque modification est envoyée à Supabase en arrière-plan (`src/lib/cloudSync.ts`), regroupée et renvoyée automatiquement en cas de coupure, y compris si l'onglet est fermé juste après. En revenant sur l'onglet, les changements faits sur un autre appareil sont récupérés. En mode en ligne, l'API de Copilot n'accepte que les étudiants connectés.

## Architecture

```
src/
  App.tsx                 routes (connexion, inscription, espace protégé)
  layout/AppShell.tsx     barre latérale, recherche globale, navigation mobile, Copilot
  pages/                  Dashboard, drive/, calendar/, notes/, profile/, admin/, AuthPage, MfaPage
  copilot/                Character (personnage SVG), Copilot (conversation), actions,
                          offers (boutons d'action), proactive (initiatives),
                          localBrain (mode simple), claudeBrain (mode IA, via le serveur)
server/
  copilot.mjs             API /api/copilot : personnalité, outils, appel à Claude
  index.mjs               serveur de production (dist/ + API)
  store/                  état Zustand : auth, drive, calendar, notes, copilot, ui, session
  lib/                    dates (analyse du langage naturel), stockage, utilitaires
```

## Limites actuelles (version de démonstration)

- **En mode local** (sans Supabase), comptes et données sont stockés dans le navigateur : changer de navigateur ou vider les données du site efface tout. Configure Supabase (voir plus haut) pour un usage réel.
- En mode local, l'API de Copilot n'a qu'une limite par adresse IP : active Supabase avant une mise en ligne publique pour qu'elle soit réservée aux comptes connectés.
- Les modifications faites en même temps sur deux appareils : la dernière enregistrée l'emporte.
