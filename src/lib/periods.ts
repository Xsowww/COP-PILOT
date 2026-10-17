// Periods: whole weeks or days that have a meaning (« En entreprise », « Vacances », « Partiels »).
// Shown as a tint on the days and a band with the name, under the events, never instead of them.

import { addDays, differenceInCalendarDays } from 'date-fns';
import { FOLDER_COLORS, folderColorKey } from '../store/drive';
import type { Usage } from './usage';
import { fromKey, toKey, validKey } from './dates';
import { uid } from './utils';

export interface Period {
  id: string;
  title: string;
  /** First and last day, both included (yyyy-MM-dd). */
  start: string;
  end: string;
  /** Key of FOLDER_COLORS. */
  color: string;
}

/** Longest period (a school year and a bit): a typo like 2062 doesn't paint forty years. */
export const MAX_DAYS = 400;
/** Repeats made at once (« every 4 weeks until June »): a year of alternance fits easily. */
export const MAX_REPEATS = 60;

/** Names offered in the form, by what the account is for. */
export const PERIOD_IDEAS: Record<Usage, { title: string; color: string }[]> = {
  etudes: [
    { title: 'En cours', color: 'bleu' },
    { title: 'En entreprise', color: 'orange' },
    { title: 'Stage', color: 'violet' },
    { title: 'Partiels', color: 'rouge' },
    { title: 'Vacances', color: 'vert' },
  ],
  travail: [
    { title: 'Congés', color: 'vert' },
    { title: 'Télétravail', color: 'bleu' },
    { title: 'Déplacement', color: 'orange' },
    { title: 'Formation', color: 'violet' },
    { title: 'Rush', color: 'rouge' },
  ],
  perso: [
    { title: 'Vacances', color: 'vert' },
    { title: 'Déplacement', color: 'orange' },
    { title: 'Garde des enfants', color: 'violet' },
    { title: 'Travaux', color: 'jaune' },
  ],
};

export const periodColor = (p: Pick<Period, 'color'>) => FOLDER_COLORS[p.color]?.color ?? FOLDER_COLORS.bleu.color;
/** Soft fill for the days (readable under the events, light and dark). */
export const periodTint = (p: Pick<Period, 'color'>, strength = 14) => `color-mix(in srgb, ${periodColor(p)} ${strength}%, transparent)`;
/** Text in the period's colour, dark enough to read on its tint. */
export const periodText = (p: Pick<Period, 'color'>) => `color-mix(in srgb, ${periodColor(p)} 72%, var(--color-ink))`;

export const sortPeriods = (list: Period[]) => [...list].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.title.localeCompare(b.title));

/** The periods covering a day, oldest start first. */
export const periodsOn = (list: Period[], key: string) => sortPeriods(list.filter(p => p.start <= key && key <= p.end));

/** The periods touching [from, to] (a week, a month). */
export const periodsBetween = (list: Period[], from: string, to: string) => sortPeriods(list.filter(p => p.start <= to && p.end >= from));

/** A period from anywhere (settings, a backup file, the server), or null when it doesn't hold up. */
export function cleanPeriod(x: unknown): Period | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  const title = typeof r.title === 'string' ? r.title.trim().slice(0, 60) : '';
  const start = validKey(typeof r.start === 'string' ? r.start : null);
  const end = validKey(typeof r.end === 'string' ? r.end : null);
  if (!title || !start || !end || end < start) return null;
  if (differenceInCalendarDays(fromKey(end), fromKey(start)) > MAX_DAYS) return null;
  return { id: typeof r.id === 'string' && r.id ? r.id : uid(), title, start, end, color: folderColorKey(r.color) ?? 'bleu' };
}

export const cleanPeriods = (list: unknown): Period[] => (Array.isArray(list) ? list.map(cleanPeriod).filter((p): p is Period => !!p) : []);

/**
 * The same period again every `everyWeeks` weeks until `until` (included): 2 weeks of classes every
 * 4 weeks for a year of alternance. The first one is `first` itself; at most MAX_REPEATS in all.
 */
export function repeatPeriod(first: Omit<Period, 'id'>, everyWeeks: number, until: string): Omit<Period, 'id'>[] {
  const out = [first];
  if (!(everyWeeks >= 1) || until <= first.start) return out;
  const length = differenceInCalendarDays(fromKey(first.end), fromKey(first.start));
  for (let i = 1; out.length < MAX_REPEATS; i++) {
    const start = toKey(addDays(fromKey(first.start), i * 7 * everyWeeks));
    if (start > until) break;
    out.push({ ...first, start, end: toKey(addDays(fromKey(start), length)) });
  }
  return out;
}

/** « du 13 au 24 oct. », « 13 oct. », « du 28 oct. au 8 nov. » */
export function periodRange(p: Pick<Period, 'start' | 'end'>, fmtDay: (d: Date, pattern: string) => string): string {
  if (p.start === p.end) return fmtDay(fromKey(p.start), 'd MMM');
  const sameMonth = p.start.slice(0, 7) === p.end.slice(0, 7);
  return `du ${fmtDay(fromKey(p.start), sameMonth ? 'd' : 'd MMM')} au ${fmtDay(fromKey(p.end), 'd MMM')}`;
}
