# COP-PILOT

Hub de productivité pour étudiants : **Drive**, **Calendrier** et **Notes** réunis dans une seule appli, avec **Copilot**, un petit robot qui se cache sur le bord de l'écran et aide l'étudiant à s'organiser.

## Démarrer

```bash
npm install
cp .env.example .env   # facultatif : choisis une IA (gratuite) pour Copilot, voir plus bas
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
| **Dashboard** | Cinq cartes : aujourd'hui (et ce qui suit), prochain examen (J-x, bouton « Planifier les révisions »), « À faire » (ajout rapide de tâches), cette semaine (charge par jour), notes récentes. |
| **Drive** | Importer des fichiers ou un dossier entier (bouton ou glisser-déposer depuis l'ordinateur), créer, renommer (F2), supprimer, copier / couper / coller (Ctrl+C / X / V), dupliquer (Ctrl+D), déplacer par glisser-déposer ou via « Déplacer vers… », Alt+glisser pour copier, sélection multiple (Ctrl / Maj + clic, Ctrl+A), clic droit, favoris, récents, vue grille ou liste avec tri, aperçu (images, PDF, vidéo, audio, texte, Word, PowerPoint) et téléchargement, **corbeille** (30 jours, restaurer, « Annuler » juste après une suppression), couleurs de dossiers, étiquettes avec filtre, **recherche dans le contenu** des PDF / Word / textes, partage d'un fichier par lien temporaire (version en ligne). |
| **Calendrier** | Ajout en langage naturel (« Exam de maths vendredi 14h », « Sport demain 18h-19h »), catégorie devinée automatiquement (cours, examen, devoir, perso, sport), bande de la semaine et vue mois, agenda du jour avec cases « c'est fait », examens à venir avec J-x, devoirs à rendre, filtres par catégorie, vue **Jour** heure par heure, déplacer un événement en le glissant (jour ou heure), **import d'emploi du temps .ics** (ENT, Google Agenda ; cours répétés compris, sans doublon en cas de réimport), notes liées à un événement. |
| **Notes** | Dossiers et sous-dossiers, créer / renommer / dupliquer / épingler / supprimer, glisser une note ou un dossier dans un autre dossier, recherche, éditeur riche (titres, gras, surlignage, listes, cases à cocher, citations, code, liens, images), sauvegarde automatique, **corbeille** (30 jours), **modèles** (fiche de révision, compte-rendu de TP, plan de dissertation, cours magistral, exposé), lier une note à des fichiers et événements, export PDF et Markdown. |
| **Profil et réglages** | En cliquant sur le profil en bas à gauche. Photo ou couleur d'avatar, établissement/filière/année (connus de Copilot), statistiques (série de jours, tâches, examens, sessions focus, notes, fichiers), thème clair / sombre / automatique, couleur d'accent (6 choix, jusqu'au casque de Copilot), réduire les animations, réglages de Copilot (affichage, initiatives, rappels, bavardage, séances de révision), sessions focus (Pomodoro), raccourcis clavier, notifications du navigateur, export/import de sauvegarde, export du calendrier en .ics, stockage utilisé, changement de mot de passe, double authentification (associer un autre téléphone), déconnexion, suppression du compte. |
| **Double authentification** | En mode en ligne, obligatoire pour chaque compte : à l'inscription, un QR code s'affiche ; on le scanne avec l'appareil photo (iPhone : Mots de passe) ou Google/Microsoft Authenticator, qui affiche un code à 6 chiffres à taper sur le site. Le code est redemandé à chaque connexion. La base elle-même refuse les données sans ce code (règles « 2fa obligatoire »). Téléphone perdu : Supabase › Authentication › Users › le compte › supprimer le facteur MFA, le QR code sera reproposé. |
| **Administration** | `/admin`, visible uniquement pour les comptes listés dans la table `admins` (et connectés avec leur code) : comptes, actifs, 2FA, stockage, notes, événements, fichiers, activité et inscriptions des 30 derniers jours, répartition du calendrier, liste des comptes avec recherche. Mise à jour en direct toutes les 20 s. Seulement des chiffres, jamais le contenu. Ajouter un admin : voir la fin de `supabase/schema.sql`. |
| **Session focus** | Minuteur Pomodoro en bas de la barre latérale : on choisit la matière, travail puis pause, son de fin, notification, Copilot te félicite. |
| **Tâches** | `/taches` (ancien `/progression`, redirigé) : liste de tâches indépendante du calendrier (en retard, aujourd'hui, à venir, sans échéance) et temps de travail de la semaine par matière, graphiques détaillés et vue tableau derrière « Voir le détail ». Les 18 badges sont dans Profil › Profil ; leur annonce par Copilot est désactivée par défaut. |
| **Groupes** | `/groupes` (version en ligne) : créer un groupe ou le rejoindre avec un code à 6 caractères, notes partagées modifiables par tous (mises à jour en direct, sans écraser le travail d'un autre), révisions en commun avec « Je viens » et ajout à son calendrier, membres (prénoms uniquement). |
| **Copilot** | Personnage accroché au bord droit de l'écran, présent sur toutes les pages. Clic pour lui parler, glisser pour le déplacer le long du bord. Voir plus bas. |

Recherche globale dans la barre du haut (Ctrl+K) : fichiers, dossiers, notes et événements.

**Accessibilité** : tout se fait au clavier (lien « Aller au contenu », menus contextuels avec Maj+F10, fenêtres qui gardent le focus et se ferment avec Échap), libellés pour les lecteurs d'écran, annonces des notifications et des messages de Copilot, contrastes vérifiés dans les deux thèmes, animations réduites si le système le demande.

## Copilot

Petit personnage (casque de pilote) accroché au bord droit de l'écran : il suit la souris des yeux, cligne, passe la tête, s'endort si tu ne fais rien, et réagit selon la situation (content, surpris, qui réfléchit…).

**Il prend des initiatives** (`src/copilot/proactive.ts`) : examen ajouté → propose de planifier des révisions ou de créer une fiche, examen proche sans révisions, devoir à rendre demain, devoir en retard, événement qui commence dans 20 minutes, veille d'examen, journée terminée, premier import… Ses propositions ont de vrais boutons (« Planifier mes révisions » crée les créneaux et la fiche), et répondre « oui » suffit. Il ne se répète pas et laisse au moins 75 s entre deux remarques.

- **Point du matin** : à la première ouverture de la journée, avant midi, « ta journée en 3 lignes » (événements du jour, tâches à faire, prochain examen) avec un bouton vers le calendrier.
- **Bilan du dimanche** : à partir de 17 h, une fois par semaine : fait / prévu, temps de concentration par matière (sessions focus), ce qui arrive la semaine suivante.
- Les deux se règlent dans Profil › Copilot et ne sont jamais répétés (mémorisés dans sa mémoire). En mode « Discret », le point du matin ne s'affiche que s'il y a quelque chose à dire.

**Il répond à tout** : culture générale, aide aux devoirs (méthode puis réponse), maths pas à pas, rédaction, conseils… avec une longueur adaptée (court pour discuter, structuré pour expliquer). Ses réponses sont mises en forme (gras, italique, listes, code) par un petit moteur Markdown maison qui ne produit que du texte React : aucun HTML n'est injecté. La fenêtre s'agrandit pour les longues réponses, chaque longue réponse a un bouton « Copier ».

**Il agit sur le site** (outils exécutés dans le navigateur, sur les données de l'étudiant) : chercher partout ou dans le texte des notes, lire une note ou **un fichier du Drive** (PDF, docx, txt, md, csv, json ; ~30 000 caractères max) pour en faire une fiche ou un quiz, créer / déplacer / supprimer des événements, planifier des révisions, créer ou compléter des notes, créer / renommer / déplacer des dossiers et fichiers, favoris, couleur des dossiers, corbeille (mettre à la corbeille, lister, restaurer), tâches (ajouter, cocher, supprimer), session focus (lancer sur une matière, arrêter), réglages (couleur, thème, animations, bavardage). Avant une suppression ou une mise à la corbeille, il demande confirmation.

**Révisions** : « Interroge-moi sur ma note de chimie » → avec l'IA, il lit la note (ou le PDF) et pose les questions une par une en corrigeant. Sans IA, il fabrique des questions à partir de la structure de la note (titres, « terme : définition », mots en **gras** à compléter) et vérifie les réponses avec tolérance (accents, fautes de frappe, mots-clés).

**Personnalité** (Profil › Copilot) : Meilleur pote (par défaut), Coach motivant, Prof patient, Zen ou Taquin, plus un champ libre « Tes instructions pour Copilot » (600 caractères, par ex. « Appelle-moi Capitaine, parle-moi de foot »). Le serveur assemble les règles de base (honnêteté, sécurité, outils, français, tutoiement), le style choisi et ces instructions, présentées comme des préférences qui ne peuvent pas lever les règles de base.

**À la voix** : bouton micro dans la conversation (reconnaissance vocale du navigateur, en français, texte affiché pendant que tu parles, envoi automatique à la fin ; masqué si le navigateur ne la gère pas, comme Firefox). Option « Lire ses réponses à voix haute » (voix française de l'appareil), avec un bouton pour arrêter la lecture.

### Brancher une IA (gratuite ou non)

Sans IA, Copilot comprend des commandes en français (« Trouve le dossier Maths », « Ajoute Partiel de chimie vendredi 10h », « Ajoute la tâche acheter une calculatrice », « Mets Brouillon à la corbeille », « Lance une session focus sur les maths », « Mode sombre », « Interroge-moi sur Histoire »…). En cas de souci avec l'IA, il bascule automatiquement sur ce mode.

Pour qu'il comprenne tout, choisis un fournisseur dans `.env` (détails dans `.env.example`) :

| `AI_PROVIDER` | Prix | Modèle par défaut | Clé |
| --- | --- | --- | --- |
| `gemini` | gratuit (limites par minute et par jour) | `gemini-2.5-flash` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `groq` | gratuit (limites) | `llama-3.3-70b-versatile` | [console.groq.com](https://console.groq.com/keys) |
| `openrouter` | gratuit avec les modèles `:free` | `meta-llama/llama-3.3-70b-instruct:free` | [openrouter.ai](https://openrouter.ai/keys) |
| `mistral` | offre gratuite « Experiment » | `mistral-small-latest` | [console.mistral.ai](https://console.mistral.ai) |
| `ollama` | gratuit, tourne sur ta machine | `llama3.1` | aucune ([ollama.com](https://ollama.com)) |
| `anthropic` | payant | `claude-opus-5-5` | [console.anthropic.com](https://console.anthropic.com) |
| `openai-compatible` | selon le service | `AI_MODEL` | `AI_BASE_URL` + `AI_API_KEY` |

Exemple gratuit en trois lignes :

```bash
AI_PROVIDER=gemini
AI_API_KEY=ta-cle-google-ai-studio
# AI_MODEL=gemini-2.5-flash   (facultatif)
```

Puis relance `npm run dev`. L'onglet Profil › Copilot affiche le fournisseur utilisé (aussi au survol de « Dans le coin » dans la conversation). Une ancienne configuration avec seulement `ANTHROPIC_API_KEY` continue de marcher.

Comment ça marche : la personnalité et les outils sont définis côté serveur (`server/copilotPrompt.mjs`). Claude passe par le SDK Anthropic ; les autres fournisseurs parlent le format « chat completions » d'OpenAI, et `server/aiProviders.mjs` convertit la conversation et les outils dans ce format puis la réponse dans le format Anthropic, si bien que le navigateur (`src/copilot/claudeBrain.ts`) ne voit aucune différence. Les erreurs sont harmonisées (clé invalide, quota atteint, panne, délai dépassé). La clé n'est jamais envoyée au navigateur.

**Confidentialité, à savoir** : ce que tu écris à Copilot, et ce qu'il lit pour te répondre (contexte du calendrier, notes ou fichiers qu'il ouvre), est envoyé au fournisseur choisi. Les offres gratuites ne sont pas neutres : **l'offre gratuite de Gemini autorise Google à utiliser les échanges pour améliorer ses modèles** (et des personnes peuvent les relire) ; certains modèles gratuits d'OpenRouter sont fournis par des hébergeurs qui conservent les données ; vérifie les conditions de Groq et Mistral selon ton offre. Évite d'y mettre des informations sensibles, ou choisis **Ollama** (tout reste sur ta machine) ou une offre payante dont les conditions excluent l'entraînement. Les petits modèles gratuits se trompent plus souvent dans l'usage des outils que Claude.

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
                          localBrain (mode simple), claudeBrain (mode IA, via le serveur),
                          Markdown (mise en forme sûre), voice (micro, lecture), quiz, fileText
server/
  copilot.mjs             API /api/copilot : authentification, limite, appel à l'IA
  copilotPrompt.mjs       personnalité, styles, outils
  aiProviders.mjs         choix du fournisseur, adaptateur format OpenAI ↔ Anthropic
  index.mjs               serveur de production (dist/ + API)
  store/                  état Zustand : auth, drive, calendar, notes, copilot, ui, session
  lib/                    dates (analyse du langage naturel), stockage, utilitaires
```

## Limites actuelles (version de démonstration)

- **En mode local** (sans Supabase), comptes et données sont stockés dans le navigateur : changer de navigateur ou vider les données du site efface tout. Configure Supabase (voir plus haut) pour un usage réel.
- En mode local, l'API de Copilot n'a qu'une limite par adresse IP : active Supabase avant une mise en ligne publique pour qu'elle soit réservée aux comptes connectés.
- Les modifications faites en même temps sur deux appareils : la dernière enregistrée l'emporte.
