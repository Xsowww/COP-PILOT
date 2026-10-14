import { CATEGORIES, type EventCategory } from '../store/calendar';

/** What the account is for, chosen in the welcome questionnaire. It only changes words and starter content. */
export type Usage = 'etudes' | 'travail' | 'perso';

export const USAGES: { key: Usage; label: string; hint: string }[] = [
  { key: 'etudes', label: 'Mes études', hint: 'Cours, partiels, révisions, exposés de groupe' },
  { key: 'travail', label: 'Mon travail', hint: 'Réunions, devis, échéances, projets d’équipe' },
  { key: 'perso', label: 'Ma vie perso', hint: 'Rendez-vous, papiers, projets, à-faire du quotidien' },
];

const CATEGORY_LABELS: Record<Usage, Record<EventCategory, string>> = {
  etudes: { cours: 'Cours', examen: 'Examen', devoir: 'Devoir', perso: 'Perso', sport: 'Sport' },
  travail: { cours: 'Réunion', examen: 'Échéance', devoir: 'Devis', perso: 'Perso', sport: 'Sport' },
  perso: { cours: 'Rendez-vous', examen: 'Important', devoir: 'À faire', perso: 'Perso', sport: 'Sport' },
};

/** The few words that differ from one usage to the other. */
export const WORDS: Record<Usage, {
  nextBig: string; noBig: string; plan: string; planned: string;
  school: string; schoolHint: string; program: string; programHint: string; level: string; levels: string[];
  groups: string; profileTab: string;
}> = {
  etudes: {
    nextBig: 'Prochain examen', noBig: 'Aucun examen à venir.', plan: 'Planifier les révisions', planned: 'Révisions planifiées',
    school: 'Établissement', schoolHint: 'Université, école…', program: 'Filière', programHint: 'Droit, info, médecine…',
    level: 'Année', levels: ['', 'Lycée', 'L1', 'L2', 'L3', 'M1', 'M2', 'BTS / BUT', 'Prépa', 'École', 'Doctorat', 'Autre'],
    groups: 'Groupes', profileTab: 'Études',
  },
  travail: {
    nextBig: 'Prochaine échéance', noBig: 'Aucune échéance à venir.', plan: 'Bloquer du temps pour préparer', planned: 'Préparation planifiée',
    school: 'Entreprise', schoolHint: 'Nom de l’entreprise', program: 'Métier', programHint: 'Graphiste, commercial…',
    level: 'Statut', levels: ['', 'Indépendant·e / freelance', 'Salarié·e', 'Dirigeant·e', 'Association', 'Autre'],
    groups: 'Équipes', profileTab: 'Travail',
  },
  perso: {
    nextBig: 'Prochain grand jour', noBig: 'Rien d’important à venir.', plan: 'Bloquer du temps pour préparer', planned: 'Préparation planifiée',
    school: 'Ville', schoolHint: 'Lyon, Lille…', program: 'Centres d’intérêt', programHint: 'Cuisine, sport, voyages…',
    level: 'Situation', levels: ['', 'Étudiant·e', 'En activité', 'En recherche', 'Parent', 'Retraité·e', 'Autre'],
    groups: 'Groupes', profileTab: 'Organisation',
  },
};

/**
 * shortcut: the category labels are swapped in place on the shared CATEGORIES object instead of a hook in every
 * component. Fine because the usage is set before the app shows any page (load / welcome) and rarely changes after.
 */
export function applyUsage(usage: Usage) {
  for (const [key, label] of Object.entries(CATEGORY_LABELS[usage] ?? CATEGORY_LABELS.etudes)) CATEGORIES[key as EventCategory].label = label;
}

/** Starter content for a brand-new account, per usage (dates are days from today). */
export const SEEDS: Record<Usage, {
  driveFolders: string[]; noteFolders: string[];
  welcome: (name: string) => string;
  extraNote: { title: string; content: string };
  events: { title: string; inDays: number; start?: string; end?: string; category: EventCategory }[];
}> = {
  etudes: {
    driveFolders: ['Cours', 'Projets', 'Administratif'],
    noteFolders: ['Cours', 'Perso'],
    welcome: name => `<h2>Salut ${name}</h2><p>Voici ton espace. Quelques repères pour démarrer :</p><ul><li><p><strong>Drive</strong> : glisse tes fichiers dans la page, clic droit pour copier, couper, renommer…</p></li><li><p><strong>Calendrier</strong> : écris simplement « Partiel de maths vendredi 14h », c'est ajouté.</p></li><li><p><strong>Notes</strong> : range tes notes dans des dossiers, comme celle-ci.</p></li></ul><p>Et si tu cherches quelque chose, demande à <strong>Kompa</strong>, le petit personnage qui t'observe depuis le bord droit de l'écran.</p>`,
    extraNote: { title: 'Méthode de révision', content: '<p>1. Relire le cours<br>2. Faire une fiche<br>3. S\'entraîner sur les annales</p>' },
    events: [
      { title: 'Cours de maths', inDays: 1, start: '09:00', end: '11:00', category: 'cours' },
      { title: 'Rendre le TP de physique', inDays: 3, start: '18:00', category: 'devoir' },
      { title: 'Partiel d\'anglais', inDays: 8, start: '14:00', end: '16:00', category: 'examen' },
    ],
  },
  travail: {
    driveFolders: ['Clients', 'Devis et factures', 'Projets', 'Administratif'],
    noteFolders: ['Réunions', 'Clients'],
    welcome: name => `<h2>Bonjour ${name}</h2><p>Voici ton espace de travail. Quelques repères pour démarrer :</p><ul><li><p><strong>Drive</strong> : range devis, factures et documents clients, clic droit pour les partager par lien.</p></li><li><p><strong>Calendrier</strong> : écris simplement « Réunion client jeudi 10h », c'est ajouté.</p></li><li><p><strong>Équipes</strong> : partage notes, fichiers et échéances avec tes collègues.</p></li></ul><p>Et si tu cherches quelque chose, demande à <strong>Kompa</strong>, le petit personnage sur le bord droit de l'écran.</p>`,
    extraNote: { title: 'Modèle de compte-rendu de réunion', content: '<p><strong>Participants :</strong></p><p><strong>Décisions :</strong></p><ul><li><p></p></li></ul><p><strong>Actions (qui, quoi, quand) :</strong></p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>' },
    events: [
      { title: 'Réunion d’équipe', inDays: 1, start: '09:30', end: '10:30', category: 'cours' },
      { title: 'Envoyer le devis', inDays: 3, start: '17:00', category: 'devoir' },
      { title: 'Échéance projet', inDays: 8, start: '12:00', category: 'examen' },
    ],
  },
  perso: {
    driveFolders: ['Papiers', 'Maison', 'Projets'],
    noteFolders: ['Idées', 'Listes'],
    welcome: name => `<h2>Salut ${name}</h2><p>Voici ton espace. Quelques repères pour démarrer :</p><ul><li><p><strong>Drive</strong> : garde tes papiers importants au même endroit (factures, contrats, ordonnances…).</p></li><li><p><strong>Calendrier</strong> : écris simplement « Dentiste mardi 17h », c'est ajouté.</p></li><li><p><strong>Notes</strong> : listes de courses, idées, projets, tout se range en dossiers.</p></li></ul><p>Et si tu cherches quelque chose, demande à <strong>Kompa</strong>, le petit personnage sur le bord droit de l'écran.</p>`,
    extraNote: { title: 'Liste de courses', content: '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Pain</p></li><li data-type="taskItem" data-checked="false"><p>Fruits</p></li></ul>' },
    events: [
      { title: 'Rendez-vous chez le médecin', inDays: 2, start: '17:30', end: '18:00', category: 'cours' },
      { title: 'Payer le loyer', inDays: 4, category: 'devoir' },
      { title: 'Anniversaire', inDays: 9, category: 'examen' },
    ],
  },
};
