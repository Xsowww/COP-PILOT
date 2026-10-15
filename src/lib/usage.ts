import { CATEGORIES, type BuiltinCategory } from '../store/calendar';

/** What the account is for, chosen in the welcome questionnaire. It only changes words and starter content. */
export type Usage = 'etudes' | 'travail' | 'perso';

export const USAGES: { key: Usage; label: string; hint: string }[] = [
  { key: 'etudes', label: 'Mes études', hint: 'Cours, partiels, révisions, exposés de groupe' },
  { key: 'travail', label: 'Mon travail', hint: 'Réunions, devis, échéances, projets d’équipe' },
  { key: 'perso', label: 'Ma vie perso', hint: 'Rendez-vous, papiers, projets, à-faire du quotidien' },
];

const CATEGORY_LABELS: Record<Usage, Record<BuiltinCategory, string>> = {
  etudes: { cours: 'Cours', examen: 'Examen', devoir: 'Devoir', perso: 'Perso', sport: 'Sport' },
  travail: { cours: 'Réunion', examen: 'Échéance', devoir: 'Devis', perso: 'Perso', sport: 'Sport' },
  perso: { cours: 'Rendez-vous', examen: 'Important', devoir: 'À faire', perso: 'Perso', sport: 'Sport' },
};

/** The few words that differ from one usage to the other. */
export const WORDS: Record<Usage, {
  nextBig: string; noBig: string; plan: string; planned: string;
  school: string; schoolHint: string; program: string; programHint: string; level: string; levels: string[];
  groups: string; profileTab: string;
  /** Calendar: example in the quick add, empty « À venir », the box that ticks a deliverable, timetable slots. */
  quickExample: string; noUpcoming: string; markDone: string; slot: string; slots: string;
}> = {
  etudes: {
    nextBig: 'Prochain examen', noBig: 'Aucun examen à venir.', plan: 'Planifier les révisions', planned: 'Révisions planifiées',
    school: 'Établissement', schoolHint: 'Université, école…', program: 'Filière', programHint: 'Droit, info, médecine…',
    level: 'Année', levels: ['', 'Lycée', 'L1', 'L2', 'L3', 'M1', 'M2', 'BTS / BUT', 'Prépa', 'École', 'Doctorat', 'Autre'],
    groups: 'Groupes', profileTab: 'Études',
    quickExample: 'Partiel de maths vendredi 14h', noUpcoming: 'Aucun examen ni rendu prévu.', markDone: 'rendu', slot: 'cours', slots: 'cours',
  },
  travail: {
    nextBig: 'Prochaine échéance', noBig: 'Aucune échéance à venir.', plan: 'Bloquer du temps pour préparer', planned: 'Préparation planifiée',
    school: 'Entreprise', schoolHint: 'Nom de l’entreprise', program: 'Métier', programHint: 'Graphiste, commercial…',
    level: 'Statut', levels: ['', 'Indépendant·e / freelance', 'Salarié·e', 'Dirigeant·e', 'Association', 'Autre'],
    groups: 'Équipes', profileTab: 'Travail',
    quickExample: 'Réunion client jeudi 10h', noUpcoming: 'Aucune échéance ni devis prévu.', markDone: 'fait', slot: 'créneau', slots: 'créneaux',
  },
  perso: {
    nextBig: 'Prochain grand jour', noBig: 'Rien d’important à venir.', plan: 'Bloquer du temps pour préparer', planned: 'Préparation planifiée',
    school: 'Ville', schoolHint: 'Lyon, Lille…', program: 'Centres d’intérêt', programHint: 'Cuisine, sport, voyages…',
    level: 'Situation', levels: ['', 'Étudiant·e', 'En activité', 'En recherche', 'Parent', 'Retraité·e', 'Autre'],
    groups: 'Groupes', profileTab: 'Organisation',
    quickExample: 'Dentiste mardi 17h30', noUpcoming: 'Rien d’important ni à faire de prévu.', markDone: 'fait', slot: 'rendez-vous', slots: 'rendez-vous',
  },
};

/**
 * shortcut: the category labels are swapped in place on the shared CATEGORIES object instead of a hook in every
 * component. Fine because the usage is set before the app shows any page (load / welcome) and rarely changes after.
 */
export function applyUsage(usage: Usage) {
  for (const [key, label] of Object.entries(CATEGORY_LABELS[usage] ?? CATEGORY_LABELS.etudes)) CATEGORIES[key as BuiltinCategory].label = label;
}

/** Shared spaces (« Groupes »): what the space and its meetings are called, with French agreement baked in. */
export interface GroupWords {
  Groups: string; groups: string; a: string; the: string; The: string; of: string; this: string; all: string; none: string; yours: string;
  created: string; deleted: string; namePlaceholder: string; mates: string; others: string; introTitle: string; introText: string; notesHint: string;
  /** The meetings planned together (study sessions, work meetings, get-togethers). */
  meet: {
    Tab: string; One: string; many: string; a: string; the: string; The: string; proposed: string; proposedMany: string; none: string; placeholder: string; hint: string;
  };
}

export const GROUP_WORDS: Record<Usage, GroupWords> = {
  etudes: {
    Groups: 'Groupes', groups: 'groupes', a: 'un groupe', the: 'le groupe', The: 'Le groupe', of: 'du groupe', this: 'ce groupe', all: 'tout le groupe',
    none: 'Aucun groupe', yours: 'un de tes groupes', created: 'Groupe créé', deleted: 'Groupe supprimé',
    namePlaceholder: 'Ex. L2 Bio — TD 3', mates: 'tes camarades', others: 'd’autres étudiants',
    introTitle: 'Travaille avec ta promo', introText: 'Notes partagées et séances de révision en commun, avec ceux qui ont le code du groupe.',
    notesHint: 'Commence une fiche de révision que tout le monde peut compléter, ou partage une note que tu as déjà écrite.',
    meet: {
      Tab: 'Révisions', One: 'Révision', many: 'révisions', a: 'une révision', the: 'la révision', The: 'La révision', proposed: 'Révision proposée', proposedMany: 'proposées',
      none: 'Aucune révision prévue', placeholder: 'Ex. Révision partiel d’anatomie',
      hint: 'Propose une séance à la BU ou en visio : chaque membre indique s’il vient et peut l’ajouter à son calendrier.',
    },
  },
  travail: {
    Groups: 'Équipes', groups: 'équipes', a: 'une équipe', the: 'l’équipe', The: 'L’équipe', of: 'de l’équipe', this: 'cette équipe', all: 'toute l’équipe',
    none: 'Aucune équipe', yours: 'une de tes équipes', created: 'Équipe créée', deleted: 'Équipe supprimée',
    namePlaceholder: 'Ex. Équipe marketing, Projet Dupont', mates: 'tes collègues', others: 'tes collègues',
    introTitle: 'Travaille avec ton équipe', introText: 'Notes, fichiers et réunions partagés, avec ceux qui ont le code de l’équipe.',
    notesHint: 'Commence une note que toute l’équipe peut compléter (compte rendu, procédure…), ou partage une note que tu as déjà écrite.',
    meet: {
      Tab: 'Réunions', One: 'Réunion', many: 'réunions', a: 'une réunion', the: 'la réunion', The: 'La réunion', proposed: 'Réunion proposée', proposedMany: 'proposées',
      none: 'Aucune réunion prévue', placeholder: 'Ex. Point hebdo projet',
      hint: 'Propose une réunion en salle ou en visio : chaque membre indique s’il vient et peut l’ajouter à son calendrier.',
    },
  },
  perso: {
    Groups: 'Groupes', groups: 'groupes', a: 'un groupe', the: 'le groupe', The: 'Le groupe', of: 'du groupe', this: 'ce groupe', all: 'tout le groupe',
    none: 'Aucun groupe', yours: 'un de tes groupes', created: 'Groupe créé', deleted: 'Groupe supprimé',
    namePlaceholder: 'Ex. Famille, Coloc, Asso du quartier', mates: 'tes proches', others: 'tes proches',
    introTitle: 'Organise-toi à plusieurs', introText: 'Notes, fichiers et rendez-vous partagés, avec ceux qui ont le code du groupe.',
    notesHint: 'Commence une note que tout le monde peut compléter (courses, organisation d’un week-end…), ou partage une note que tu as déjà écrite.',
    meet: {
      Tab: 'Rendez-vous', One: 'Rendez-vous', many: 'rendez-vous', a: 'un rendez-vous', the: 'le rendez-vous', The: 'Le rendez-vous', proposed: 'Rendez-vous proposé', proposedMany: 'proposés',
      none: 'Aucun rendez-vous prévu', placeholder: 'Ex. Repas de famille',
      hint: 'Propose un rendez-vous : chaque membre indique s’il vient et peut l’ajouter à son calendrier.',
    },
  },
};

export const groupWords = (usage: Usage | undefined) => GROUP_WORDS[usage ?? 'etudes'] ?? GROUP_WORDS.etudes;
