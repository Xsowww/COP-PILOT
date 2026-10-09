# COP-PILOT

Hub de productivité pour étudiants : **Drive**, **Calendrier** et **Notes** réunis dans une seule appli, avec **Copilot**, un petit robot qui se cache sur le bord de l'écran et aide l'étudiant à s'organiser.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production dans dist/
npm run lint
```

Node 20+ (voir `.nvmrc`). Un devcontainer est fourni pour GitHub Codespaces.

## Ce que contient l'appli

| Espace | Fonctionnalités |
| --- | --- |
| **Connexion / inscription** | Comptes multiples sur le même navigateur, mot de passe haché (PBKDF2), chaque compte a ses propres données. Un nouveau compte reçoit quelques éléments de départ. |
| **Dashboard** | Widgets « à la iCloud » : accueil et actions rapides, prochain examen (compte à rebours), progression de la semaine, événements des 7 prochains jours, notes récentes, Drive (espace utilisé, favoris/récents), accès à Copilot. |
| **Drive** | Importer des fichiers ou un dossier entier (bouton ou glisser-déposer depuis l'ordinateur), créer, renommer (F2), supprimer, copier / couper / coller (Ctrl+C / X / V), dupliquer (Ctrl+D), déplacer par glisser-déposer ou via « Déplacer vers… », Alt+glisser pour copier, sélection multiple (Ctrl / Maj + clic, Ctrl+A), clic droit, favoris, récents, vue grille ou liste avec tri, aperçu (images, PDF, vidéo, audio, texte) et téléchargement. |
| **Calendrier** | Ajout en langage naturel (« Exam de maths vendredi 14h », « Sport demain 18h-19h »), catégorie devinée automatiquement (cours, examen, devoir, perso, sport), bande de la semaine et vue mois, agenda du jour avec cases « c'est fait », examens à venir avec J-x, devoirs à rendre, filtres par catégorie. |
| **Notes** | Dossiers et sous-dossiers, créer / renommer / dupliquer / épingler / supprimer, glisser une note ou un dossier dans un autre dossier, recherche, éditeur riche (titres, gras, surlignage, listes, cases à cocher, citations, code, liens), sauvegarde automatique. |
| **Copilot** | Robot 2D qui tient le bord droit de l'écran, suit la souris des yeux, cligne, passe la tête de temps en temps et fait des remarques (accueil, examen ajouté…). Clic pour lui parler, glisser pour le déplacer le long du bord. |

Recherche globale dans la barre du haut (Ctrl+K) : fichiers, dossiers, notes et événements.

## Copilot : deux modes

- **Mode local** (par défaut, sans clé) : comprend des commandes en français et agit vraiment sur l'espace :
  « Trouve le dossier Maths », « Analyse mon calendrier », « Crée une note Révisions : chapitre 3 », « Crée un dossier Stage dans Projets », « Ajoute Exam de physique vendredi 10h », « Qu'est-ce que j'ai demain ? », « Montre le dossier Cours ».
- **Mode IA** : dans les réglages de Copilot (⚙️), coller une clé API Anthropic. Copilot passe alors par Claude (`claude-opus-5-5`) avec des outils pour chercher, analyser le calendrier, créer des notes, dossiers et événements, lire une note. La clé reste dans le navigateur de l'utilisateur.

## Architecture

```
src/
  App.tsx                 routes (connexion, inscription, espace protégé)
  layout/AppShell.tsx     barre latérale, recherche globale, navigation mobile, Copilot
  pages/                  Dashboard, drive/, calendar/, notes/, AuthPage
  copilot/                Character (SVG animé), Copilot (bulle de conversation),
                          actions (ce que Copilot sait faire), localBrain, claudeBrain
  store/                  état Zustand : auth, drive, calendar, notes, copilot, ui, session
  lib/                    dates (analyse du langage naturel), stockage, utilitaires
```

## Limites actuelles (version de démonstration)

- **Pas de serveur** : comptes et données sont stockés dans le navigateur (localStorage pour les données, IndexedDB pour le contenu des fichiers). Changer de navigateur ou vider les données du site efface tout. Le module `src/store/auth.ts` et les stores sont prévus pour être branchés plus tard sur un vrai backend (Supabase, Firebase, API maison…).
- Le mode IA appelle l'API Claude directement depuis le navigateur avec la clé de l'utilisateur. Pour une mise en production, il faudra passer par un serveur qui garde la clé.
