import { addDays, format, isValid, parseISO, startOfWeek, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export const toKey = (d: Date) => format(d, 'yyyy-MM-dd');
export const fromKey = (k: string) => parseISO(k);
export const todayKey = () => toKey(new Date());
export const weekStart = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });
export const fmt = (d: Date, pattern: string) => format(d, pattern, { locale: fr });
export const daysUntil = (key: string) => differenceInCalendarDays(fromKey(key), new Date());

export function countdownLabel(key: string): string {
  const n = daysUntil(key);
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return 'Demain';
  if (n === -1) return 'Hier';
  if (n < 0) return `Il y a ${-n} j`;
  return `J-${n}`;
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

export interface ParsedQuickAdd {
  title: string;
  date: string | null;
  start: string | null;
  end: string | null;
}

/**
 * Understands simple French sentences such as
 * "Exam de maths vendredi 14h", "Rendre TP le 12/11 à 9h30", "Sport demain 18h-19h".
 */
export function parseQuickAdd(input: string, base = new Date()): ParsedQuickAdd {
  let text = ` ${input} `;
  let date: Date | null = null;
  let start: string | null = null;
  let end: string | null = null;
  // Same length as `text` (accents stripped, no trim) so match indices map back.
  const n = () => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const cut = (re: RegExp) => {
    const m = n().match(re);
    if (!m || m.index === undefined) return null;
    text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length);
    return m;
  };

  // Times: "14h", "14h30", "14:30", "de 14h à 16h", "14h-16h"
  const range = cut(/\s(?:de\s)?(\d{1,2})\s?(?:h|:)\s?(\d{2})?\s?(?:-|a|à|jusqu'a)\s?(\d{1,2})\s?(?:h|:)\s?(\d{2})?(?=\s)/);
  if (range) {
    start = `${range[1].padStart(2, '0')}:${range[2] ?? '00'}`;
    end = `${range[3].padStart(2, '0')}:${range[4] ?? '00'}`;
  } else {
    const t = cut(/\s(?:a\s|vers\s)?(\d{1,2})\s?(?:h|:)\s?(\d{2})?(?=\s)/);
    if (t && Number(t[1]) < 24) start = `${t[1].padStart(2, '0')}:${t[2] ?? '00'}`;
  }

  // Relative days: "dans 5 jours", "dans une semaine", "demain"…
  const rel = cut(/\sdans\s(\d{1,3}|une|deux|trois)\s(jours?|semaines?)(?=\s)/);
  if (rel) {
    const n = ({ une: 1, deux: 2, trois: 3 } as Record<string, number>)[rel[1]] ?? Number(rel[1]);
    date = addDays(base, rel[2].startsWith('semaine') ? n * 7 : n);
  } else if (cut(/\s(?:apres-demain|apres demain)(?=\s)/)) date = addDays(base, 2);
  else if (cut(/\sdemain(?=\s)/)) date = addDays(base, 1);
  else if (cut(/\s(?:aujourd'hui|aujourdhui|ce soir|ce matin|cet aprem)(?=\s)/)) date = base;

  // dd/mm(/yyyy)
  if (!date) {
    const m = cut(/\s(?:le\s)?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?=\s)/);
    if (m) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : base.getFullYear();
      date = new Date(y, Number(m[2]) - 1, Number(m[1]));
      if (!m[3] && differenceInCalendarDays(date, base) < -30) date.setFullYear(y + 1);
    }
  }

  // "12 novembre"
  if (!date) {
    const m = cut(new RegExp(`\\s(?:le\\s)?(\\d{1,2})\\s(${MONTHS.join('|')})(?:\\s(\\d{4}))?(?=\\s)`));
    if (m) {
      const y = m[3] ? Number(m[3]) : base.getFullYear();
      date = new Date(y, MONTHS.indexOf(m[2]), Number(m[1]));
      if (!m[3] && differenceInCalendarDays(date, base) < -30) date.setFullYear(y + 1);
    }
  }

  // Weekday names: "vendredi", "lundi prochain"
  if (!date) {
    const m = cut(new RegExp(`\\s(?:ce\\s|le\\s)?(${WEEKDAYS.join('|')})(?:\\sprochain)?(?=\\s)`));
    if (m) {
      const target = WEEKDAYS.indexOf(m[1]);
      let delta = (target - base.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      date = addDays(base, delta);
    }
  }

  const title = text
    .replace(/\s+/g, ' ')
    .replace(/\s(le|a|à|de|pour)\s*$/i, '')
    .trim();

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    date: date && isValid(date) ? toKey(date) : null,
    start,
    end,
  };
}

/** "08:15" → 495 */
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** 495 → "08:15" (clamped to the day). */
export const fromMinutes = (min: number) => {
  const v = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};
