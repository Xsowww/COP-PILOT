import type { PersonaKey } from '../store/settings';
import type { Usage } from './usage';

// \u00a0: French spacing that never breaks a line (« », ?).

/** How Kompaly can talk: the same names in the welcome questionnaire and in the profile. */
export const PERSONAS: { key: PersonaKey; label: string; description: string; example: string }[] = [
  { key: 'pote', label: 'Meilleur pote', description: 'Drôle et détendu, sérieux quand il le faut.', example: '«\u00a0Partiel jeudi\u00a0? On cale trois séances et tu gères.\u00a0»' },
  { key: 'coach', label: 'Coach motivant', description: 'Te pousse à passer à l’action, fête chaque progrès.', example: '«\u00a025 minutes, une seule tâche. Go, je chronomètre.\u00a0»' },
  { key: 'prof', label: 'Prof patient', description: 'Explique pas à pas et vérifie que c’est compris.', example: '«\u00a0Reprenons depuis la définition, avec un exemple.\u00a0»' },
  { key: 'zen', label: 'Zen', description: 'Calme, aide à prendre du recul quand ça déborde.', example: '«\u00a0Une chose à la fois. Laquelle est la plus simple\u00a0?\u00a0»' },
  { key: 'taquin', label: 'Taquin', description: 'Te charrie gentiment, jamais méchant.', example: '«\u00a0Douze onglets ouverts et zéro fiche. Audacieux.\u00a0»' },
];

/** « Prof patient » speaks to a student: at work and at home, the same personality is a « Pédagogue patient ». */
const OTHER_LABELS: Partial<Record<PersonaKey, string>> = { prof: 'Pédagogue patient' };

/** Name of a personality in the account's usage (the setting key stays the same). */
export const personaLabel = (p: { key: PersonaKey; label: string }, usage: Usage | undefined) =>
  (usage ?? 'etudes') === 'etudes' ? p.label : (OTHER_LABELS[p.key] ?? p.label);
