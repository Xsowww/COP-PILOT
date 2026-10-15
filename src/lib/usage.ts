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
