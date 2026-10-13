# Avant le lancement — liste de travail

Issue de l'audit complet du 13/10/2026. On coche au fur et à mesure.
Ensuite : le document de lancement (hébergement, domaine, stores, légal).

## Lot 1 — Sécurité et bugs rapides
- [x] Les PDF ne marchent pas en production (type `.mjs` du moteur PDF)
- [x] Aperçu « PDF » piégé qui exécute du code chez les autres membres
- [x] « Supprimer mon compte » contourne la 2FA (SQL à appliquer : `2026-10-13d_suppression_compte_2fa.sql`)
- [x] Images effacées quand on partage une note dans un groupe
- [x] Données lisibles sur l'ordinateur après déconnexion (PC partagés)
- [x] Impression d'une note : code caché d'une sauvegarde importée exécuté
- [x] Requête trop grosse : connexion coupée au lieu d'un message clair

## Lot 2 — Copilot / IA gratuite
- [x] Quota par élève et par jour + taille maximale des messages
- [x] Fichier de cours trop long pour Groq → limite adaptée + message clair
- [x] Historique de conversation coupé proprement (plus de blocage après de longues sessions)
- [x] Suppressions par l'IA : bouton « Confirmer » obligatoire, identifiant exact
- [x] Un « oui » qui déclenche une suggestion au lieu de répondre à l'IA
- [x] Faux jetons de connexion : limite par IP, mémoire qui grossit
- [x] Mode local qui ouvre l'IA sans connexion en production

## Lot 3 — Synchronisation (ne jamais perdre de travail)
- [x] Une ligne refusée bloque toute la synchro de l'appareil
- [x] Un appareil en retard écrase les notes plus récentes (+ compteur de concentration) (SQL à appliquer : `2026-10-14_synchro_version_recente.sql`)
- [x] Plus de 1000 éléments : une partie disparaît
- [x] Rechargement en plein milieu d'une modification qui la défait
- [x] Deux onglets hors ligne qui s'écrasent
- [x] Restauration d'une sauvegarde qui supprime définitivement
- [x] Images dans les notes qui remplissent la mémoire du navigateur (alerte claire ; stocker les images en ligne : plus tard)

## Lot 4 — Fichiers et stockage
- [ ] Fichiers restants après suppression de compte / de groupe (RGPD)
- [ ] Taille maximale par fichier et quota par élève
- [ ] Envoi de plusieurs fichiers interrompu : fichiers invisibles qui restent
- [ ] Lien de partage encore valable 30 jours après suppression

## Lot 5 — Serveur de production
- [ ] Écran blanc après une mise à jour du site (erreur 404 + écran « Recharger »)
- [ ] Compression, en-têtes de sécurité, URL malformée, journal d'erreurs
- [ ] Écran blanc pendant le chargement, Drive et Agenda chargés à la demande

## Lot 6 — Groupes et agenda
- [ ] Temps réel non filtré et comptage toutes les 30 s trop coûteux
- [ ] Démarrage / arrêt des pastilles qui double le comptage
- [ ] .ics : cours annulés encore affichés, réimport qui ne met rien à jour

## Lot 7 — Tests et ménage
- [ ] Tests automatiques (dates, .ics, adaptateur IA, synchro) + vérification à chaque push
- [ ] Code en double / jamais utilisé, dépendances inutiles, `npm audit fix`
- [ ] Calcul lent après un gros import .ics
- [ ] README à jour, `graphify-out/` dans `.gitignore`, Node 22

## Lot 8 — Ce qui manque pour lancer
- [ ] Application installable sur téléphone (manifeste, icônes)
- [ ] Référencement : description, `robots.txt`, `sitemap.xml`
- [ ] Codes de secours 2FA (téléphone perdu = compte bloqué)
- [ ] Suivi des erreurs en production
- [ ] Pages légales (mentions, confidentialité, CGU)

## Avant d'ouvrir au public
- [ ] Révoquer le jeton Supabase (sbp_…) et régénérer la clé Groq (passés dans le chat)
