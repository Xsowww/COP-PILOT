import { Briefcase, CalendarClock, ListOrdered, Plane, Presentation, ShoppingCart, Sprout, TrendingUp, Users, Wallet, type LucideIcon } from 'lucide-react';
import { getSettings } from '../../store/settings';
import type { Usage } from '../../lib/usage';

/** Ready-made note structures (French). `html()` is called at creation so dates are current. */
export interface NoteTemplate {
  id: string;
  label: string;
  /** One line shown in the « Nouvelle note » menu. */
  hint: string;
  /** Default note title. */
  title: string;
  html: () => string;
  /** Icon in the « Nouvelle note » menu (the study ones are chosen in NotesPage). */
  icon?: LucideIcon;
}

const today = () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const tasks = (items: string[]) =>
  `<ul data-type="taskList">${items.map(t => `<li data-type="taskItem" data-checked="false"><p>${t}</p></li>`).join('')}</ul>`;
const list = (items: string[]) => `<ul>${items.map(t => `<li><p>${t}</p></li>`).join('')}</ul>`;
const olist = (items: string[]) => `<ol>${items.map(t => `<li><p>${t}</p></li>`).join('')}</ol>`;

/** Studies. */
export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'vide',
    label: 'Note vide',
    hint: 'Une page blanche',
    title: 'Sans titre',
    html: () => '',
  },
  {
    id: 'fiche',
    label: 'Fiche de révision',
    hint: 'Notions, définitions, formules, auto-test',
    title: 'Fiche de révision',
    html: () =>
      [
        '<p><strong>Matière :</strong> </p>',
        '<p><strong>Chapitre :</strong> </p>',
        '<h2>L’essentiel en 3 phrases</h2>',
        olist(['', '', '']),
        '<h2>Définitions</h2>',
        list(['<strong>Terme</strong> : ']),
        '<h2>Formules et règles</h2>',
        list(['']),
        '<h2>Exemple type</h2>',
        '<p></p>',
        '<h2>Pièges à éviter</h2>',
        list(['']),
        '<h2>Je sais…</h2>',
        tasks(['Réciter les définitions sans regarder', 'Refaire l’exemple type seul', 'Expliquer le chapitre à quelqu’un en 2 minutes']),
      ].join(''),
  },
  {
    id: 'tp',
    label: 'Compte-rendu de TP',
    hint: 'Objectif, protocole, résultats, analyse',
    title: 'Compte-rendu de TP',
    html: () =>
      [
        `<p><strong>Date :</strong> ${today()}</p>`,
        '<p><strong>Binôme :</strong> </p>',
        '<h2>Objectif</h2>',
        '<p>Ce que le TP cherche à mesurer ou à montrer.</p>',
        '<h2>Matériel</h2>',
        list(['']),
        '<h2>Protocole</h2>',
        olist(['']),
        '<h2>Résultats</h2>',
        '<p>Mesures, tableaux, observations (avec unités et incertitudes).</p>',
        '<h2>Analyse</h2>',
        '<p>Interprétation, comparaison avec la théorie, sources d’erreur.</p>',
        '<h2>Conclusion</h2>',
        '<p></p>',
        '<h2>Avant de rendre</h2>',
        tasks(['Unités et chiffres significatifs vérifiés', 'Schémas et graphiques légendés', 'Noms du binôme sur la première page']),
      ].join(''),
  },
  {
    id: 'dissertation',
    label: 'Plan de dissertation',
    hint: 'Problématique et plan en deux ou trois parties',
    title: 'Plan de dissertation',
    html: () =>
      [
        '<p><strong>Sujet :</strong> </p>',
        '<h2>Introduction</h2>',
        list(['<strong>Accroche</strong> : ', '<strong>Définition des termes</strong> : ', '<strong>Problématique</strong> : ', '<strong>Annonce du plan</strong> : ']),
        '<h2>I. </h2>',
        list(['<strong>A.</strong> Argument — exemple', '<strong>B.</strong> Argument — exemple']),
        '<p><em>Transition :</em> </p>',
        '<h2>II. </h2>',
        list(['<strong>A.</strong> Argument — exemple', '<strong>B.</strong> Argument — exemple']),
        '<p><em>Transition :</em> </p>',
        '<h2>III. </h2>',
        list(['<strong>A.</strong> Argument — exemple', '<strong>B.</strong> Argument — exemple']),
        '<h2>Conclusion</h2>',
        list(['<strong>Bilan</strong> : réponse à la problématique', '<strong>Ouverture</strong> : ']),
        '<h2>Références à placer</h2>',
        list(['']),
      ].join(''),
  },
  {
    id: 'cours',
    label: 'Cours magistral',
    hint: 'Prise de notes structurée, questions, à retenir',
    title: 'Cours',
    html: () =>
      [
        `<p><strong>Date :</strong> ${today()}</p>`,
        '<p><strong>Enseignant :</strong> </p>',
        '<h2>Plan du cours</h2>',
        olist(['']),
        '<h2>Notes</h2>',
        '<p></p>',
        '<h2>À retenir</h2>',
        '<blockquote><p>Les 3 idées à savoir pour l’examen.</p></blockquote>',
        '<h2>Questions à poser</h2>',
        list(['']),
        '<h2>Après le cours</h2>',
        tasks(['Relire et compléter les notes le soir même', 'Faire une fiche de révision', 'Chercher les points non compris']),
      ].join(''),
  },
  {
    id: 'expose',
    label: 'Exposé / oral',
    hint: 'Déroulé minuté, répartition, répétitions',
    title: 'Exposé',
    html: () =>
      [
        '<p><strong>Sujet :</strong> </p>',
        '<p><strong>Date de passage :</strong> </p>',
        '<p><strong>Durée :</strong> 10 min + questions</p>',
        '<h2>Message principal</h2>',
        '<p>Ce que le public doit retenir en une phrase.</p>',
        '<h2>Déroulé</h2>',
        olist(['<strong>Introduction</strong> (1 min) — ', '<strong>Partie 1</strong> (4 min) — ', '<strong>Partie 2</strong> (4 min) — ', '<strong>Conclusion</strong> (1 min) — ']),
        '<h2>Qui fait quoi</h2>',
        list(['']),
        '<h2>Questions probables</h2>',
        list(['']),
        '<h2>Préparation</h2>',
        tasks(['Diapositives terminées', 'Répétition chronométrée', 'Répétition devant quelqu’un', 'Support testé sur l’ordinateur de la salle']),
      ].join(''),
  },
];

// \u00a0: French spacing that never breaks a line (« Date : », « Qui ? »).
const field = (label: string, value = '') => `<p><strong>${label}\u00a0:</strong> ${value}</p>`;

const BLANK = NOTE_TEMPLATES[0];

/** Work: meetings, projects, follow-up. */
const WORK_TEMPLATES: NoteTemplate[] = [
  BLANK,
  {
    id: 'compte-rendu',
    label: 'Compte rendu de réunion',
    hint: 'Participants, décisions, actions à mener',
    title: 'Compte rendu de réunion',
    icon: Users,
    html: () =>
      [
        field('Date', today()),
        field('Participants'),
        field('Objet'),
        '<h2>Points abordés</h2>',
        list(['']),
        '<h2>Décisions</h2>',
        list(['']),
        '<h2>Actions</h2>',
        tasks(['Action — qui — pour quand']),
        '<h2>Prochaine réunion</h2>',
        '<p></p>',
      ].join(''),
  },
  {
    id: 'ordre-du-jour',
    label: 'Ordre du jour',
    hint: 'Points à traiter, durée, ce qu’il faut préparer',
    title: 'Ordre du jour',
    icon: ListOrdered,
    html: () =>
      [
        field('Réunion'),
        field('Date et heure'),
        field('Lieu ou lien'),
        field('Participants'),
        '<h2>Objectif</h2>',
        '<p>Ce qu’on doit avoir décidé à la fin.</p>',
        '<h2>Points à traiter</h2>',
        olist(['<strong>Tour de table</strong> (5 min) — ', '<strong>Point 1</strong> (15 min) — ', '<strong>Point 2</strong> (15 min) — ', '<strong>Prochaines étapes</strong> (5 min) — ']),
        '<h2>À préparer avant</h2>',
        tasks(['Envoyer l’ordre du jour aux participants', 'Documents à partager', 'Salle ou lien de visio réservé']),
      ].join(''),
  },
  {
    id: 'brief-projet',
    label: 'Brief de projet',
    hint: 'Contexte, objectifs, livrables, échéances',
    title: 'Brief de projet',
    icon: Briefcase,
    html: () =>
      [
        field('Projet'),
        field('Client ou commanditaire'),
        field('Responsable'),
        '<h2>Contexte</h2>',
        '<p>D’où vient le besoin, ce qui existe déjà.</p>',
        '<h2>Objectifs</h2>',
        list(['']),
        '<h2>Livrables</h2>',
        list(['']),
        '<h2>Échéances</h2>',
        list(['<strong>Lancement</strong>\u00a0: ', '<strong>Point d’étape</strong>\u00a0: ', '<strong>Livraison</strong>\u00a0: ']),
        '<h2>Budget et moyens</h2>',
        '<p></p>',
        '<h2>Risques et questions ouvertes</h2>',
        list(['']),
      ].join(''),
  },
  {
    id: 'point-hebdo',
    label: 'Point hebdo',
    hint: 'Fait, en cours, bloquants, semaine prochaine',
    title: 'Point hebdo',
    icon: TrendingUp,
    html: () =>
      [
        field('Date', today()),
        '<h2>Fait cette semaine</h2>',
        list(['']),
        '<h2>En cours</h2>',
        list(['']),
        '<h2>Bloquants</h2>',
        list(['']),
        '<h2>Semaine prochaine</h2>',
        tasks(['']),
      ].join(''),
  },
  {
    id: 'presentation',
    label: 'Présentation',
    hint: 'Message clé, déroulé minuté, questions probables',
    title: 'Présentation',
    icon: Presentation,
    html: () =>
      [
        field('Sujet'),
        field('Public'),
        field('Date'),
        field('Durée', '20 min + questions'),
        '<h2>Message clé</h2>',
        '<p>Ce que le public doit retenir en une phrase.</p>',
        '<h2>Déroulé</h2>',
        olist(['<strong>Introduction</strong> (2 min) — ', '<strong>Constat</strong> (5 min) — ', '<strong>Proposition</strong> (10 min) — ', '<strong>Prochaines étapes</strong> (3 min) — ']),
        '<h2>Questions probables</h2>',
        list(['']),
        '<h2>Avant de présenter</h2>',
        tasks(['Support terminé', 'Répétition chronométrée', 'Support envoyé ou partagé']),
      ].join(''),
  },
];

/** Personal life: lists, projects, trips, appointments, money. */
const PERSONAL_TEMPLATES: NoteTemplate[] = [
  BLANK,
  {
    id: 'courses',
    label: 'Liste de courses',
    hint: 'Par rayon, à cocher au magasin',
    title: 'Courses',
    icon: ShoppingCart,
    html: () =>
      [
        '<h2>Frais</h2>',
        tasks(['']),
        '<h2>Épicerie</h2>',
        tasks(['']),
        '<h2>Fruits et légumes</h2>',
        tasks(['']),
        '<h2>Maison</h2>',
        tasks(['']),
      ].join(''),
  },
  {
    id: 'projet-perso',
    label: 'Projet perso',
    hint: 'Objectif, étapes, budget, idées',
    title: 'Projet perso',
    icon: Sprout,
    html: () =>
      [
        field('Objectif'),
        field('Pour quand'),
        '<h2>Pourquoi</h2>',
        '<p></p>',
        '<h2>Étapes</h2>',
        tasks(['', '', '']),
        '<h2>Budget</h2>',
        list(['']),
        '<h2>Idées et liens</h2>',
        list(['']),
      ].join(''),
  },
  {
    id: 'voyage',
    label: 'Préparer un voyage',
    hint: 'Trajets, hébergement, valise, programme',
    title: 'Voyage',
    icon: Plane,
    html: () =>
      [
        field('Destination'),
        field('Dates'),
        '<h2>Trajets</h2>',
        list(['<strong>Aller</strong>\u00a0: ', '<strong>Retour</strong>\u00a0: ']),
        '<h2>Hébergement</h2>',
        '<p></p>',
        '<h2>Programme</h2>',
        list(['']),
        '<h2>Dans la valise</h2>',
        tasks(['Papiers d’identité', 'Chargeurs', 'Trousse de toilette', 'Médicaments']),
        '<h2>Avant de partir</h2>',
        tasks(['Billets imprimés ou dans le téléphone', 'Plantes arrosées', 'Poubelles sorties']),
      ].join(''),
  },
  {
    id: 'rendez-vous',
    label: 'Rendez-vous',
    hint: 'Questions à poser, documents à apporter',
    title: 'Rendez-vous',
    icon: CalendarClock,
    html: () =>
      [
        field('Avec'),
        field('Date et lieu'),
        '<h2>Questions à poser</h2>',
        list(['']),
        '<h2>À apporter</h2>',
        tasks(['Pièce d’identité', '']),
        '<h2>Ce qui a été dit</h2>',
        '<p></p>',
        '<h2>À faire ensuite</h2>',
        tasks(['']),
      ].join(''),
  },
  {
    id: 'budget',
    label: 'Budget du mois',
    hint: 'Rentrées, dépenses, épargne',
    title: 'Budget du mois',
    icon: Wallet,
    html: () =>
      [
        field('Mois'),
        '<h2>Rentrées</h2>',
        list(['<strong>Salaire</strong>\u00a0: ', '<strong>Autres</strong>\u00a0: ']),
        '<h2>Dépenses fixes</h2>',
        list(['<strong>Loyer</strong>\u00a0: ', '<strong>Énergie</strong>\u00a0: ', '<strong>Abonnements</strong>\u00a0: ']),
        '<h2>Dépenses courantes</h2>',
        list(['<strong>Courses</strong>\u00a0: ', '<strong>Transports</strong>\u00a0: ', '<strong>Loisirs</strong>\u00a0: ']),
        '<h2>Épargne</h2>',
        '<p></p>',
        '<h2>À surveiller</h2>',
        tasks(['']),
      ].join(''),
  },
];

const BY_USAGE: Record<Usage, NoteTemplate[]> = { etudes: NOTE_TEMPLATES, travail: WORK_TEMPLATES, perso: PERSONAL_TEMPLATES };

/** The templates of the account's usage (studies: revision sheet, lab report…; work: meeting minutes, agenda…). */
export const noteTemplates = (usage: Usage | undefined = getSettings().usage) => BY_USAGE[usage ?? 'etudes'] ?? NOTE_TEMPLATES;
