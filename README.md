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
| **Dashboard** | Widgets : programme du jour, prochain examen (J-x, bouton « Planifier les révisions »), semaine (progression et charge par jour), à venir, notes récentes, Drive (espace utilisé, fichiers récents), actions rapides. |
| **Drive** | Importer des fichiers ou un dossier entier (bouton ou glisser-déposer depuis l'ordinateur), créer, renommer (F2), supprimer, copier / couper / coller (Ctrl+C / X / V), dupliquer (Ctrl+D), déplacer par glisser-déposer ou via « Déplacer vers… », Alt+glisser pour copier, sélection multiple (Ctrl / Maj + clic, Ctrl+A), clic droit, favoris, récents, vue grille ou liste avec tri, aperçu (images, PDF, vidéo, audio, texte) et téléchargement. |
| **Calendrier** | Ajout en langage naturel (« Exam de maths vendredi 14h », « Sport demain 18h-19h »), catégorie devinée automatiquement (cours, examen, devoir, perso, sport), bande de la semaine et vue mois, agenda du jour avec cases « c'est fait », examens à venir avec J-x, devoirs à rendre, filtres par catégorie. |
| **Notes** | Dossiers et sous-dossiers, créer / renommer / dupliquer / épingler / supprimer, glisser une note ou un dossier dans un autre dossier, recherche, éditeur riche (titres, gras, surlignage, listes, cases à cocher, citations, code, liens), sauvegarde automatique. |
| **Copilot** | Personnage accroché au bord droit de l'écran, présent sur toutes les pages. Clic pour lui parler, glisser pour le déplacer le long du bord. Voir plus bas. |

Recherche globale dans la barre du haut (Ctrl+K) : fichiers, dossiers, notes et événements.

## Copilot

Petit personnage (casque de pilote) accroché au bord droit de l'écran : il suit la souris des yeux, cligne, passe la tête, s'endort si tu ne fais rien, et réagit selon la situation (content, surpris, qui réfléchit…).

**Il prend des initiatives** (`src/copilot/proactive.ts`) : salut à l'ouverture avec le programme du jour, examen ajouté → propose de planifier des révisions ou de créer une fiche, examen proche sans révisions, devoir à rendre demain, devoir en retard, événement qui commence dans 20 minutes, veille d'examen, journée terminée, premier import… Ses propositions ont de vrais boutons (« Planifier mes révisions » crée les créneaux et la fiche), et répondre « oui » suffit. Il ne se répète pas et laisse au moins 75 s entre deux remarques.

**Deux cerveaux :**
- **Avec une clé API** (`ANTHROPIC_API_KEY` dans `.env`) : Copilot passe par Claude via le serveur (`server/copilot.mjs`). Sa personnalité (meilleur pote, drôle mais sérieux quand il faut) et ses outils sont définis côté serveur : chercher, analyser le calendrier, créer/modifier des événements, planifier des révisions, créer/compléter des notes, créer des dossiers, ouvrir une page. Ses remarques spontanées sont aussi rédigées par Claude. La clé n'est jamais envoyée au navigateur.
- **Sans clé** : il comprend des commandes en français (« Trouve le dossier Maths », « Analyse ma semaine », « Planifie mes révisions », « Crée une note Révisions : chapitre 3 », « Ajoute Partiel de chimie dans 5 jours à 10h », « Raconte une blague »…). En cas de souci avec l'API, il bascule automatiquement sur ce mode.

## Architecture

```
src/
  App.tsx                 routes (connexion, inscription, espace protégé)
  layout/AppShell.tsx     barre latérale, recherche globale, navigation mobile, Copilot
  pages/                  Dashboard, drive/, calendar/, notes/, AuthPage
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

- **Pas de serveur** : comptes et données sont stockés dans le navigateur (localStorage pour les données, IndexedDB pour le contenu des fichiers). Changer de navigateur ou vider les données du site efface tout. Le module `src/store/auth.ts` et les stores sont prévus pour être branchés plus tard sur un vrai backend (Supabase, Firebase, API maison…).
- L'API de Copilot a une limite de requêtes par adresse IP mais pas encore d'authentification : à ajouter avec le vrai backend avant une mise en ligne publique, pour que personne d'autre ne consomme ta clé.
