import { addDays, format, isValid, parseISO, startOfWeek, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export const toKey = (d: Date) => format(d, 'yyyy-MM-dd');
export const fromKey = (k: string) => parseISO(k);
export const todayKey = () => toKey(new Date());
/** A real yyyy-MM-dd day (« abc » or « 2026-02-30 » from a damaged link give null). */
export const validKey = (k: string | null | undefined): string | null => {
  if (!k || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return null;
  const d = parseISO(k);
  return isValid(d) && toKey(d) === k ? k : null;
};
export const weekStart = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });
/** date-fns in French; « 1er novembre », not « 1 novembre » (the day token right before a month name). */
export const fmt = (d: Date, pattern: string) => format(d, d.getDate() === 1 ? pattern.replace(/(^|[^d'])d(?=\s+M)/, "$1d'er'") : pattern, { locale: fr });
/** Like fmt, with the year when it isn't this one (a deadline next year doesn't look close). */
export const fmtDay = (d: Date, pattern: string) => fmt(d, d.getFullYear() === new Date().getFullYear() ? pattern : `${pattern} yyyy`);
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
// Full names and the usual short forms (« 3 nov », « 12 sept. »), longest first so the regex takes the whole word.
const MONTH_WORDS = [...MONTHS, 'janv', 'fevr', 'fev', 'avr', 'juil', 'sept', 'oct', 'nov', 'dec'].sort((a, b) => b.length - a.length);
const monthIndex = (word: string) => MONTHS.findIndex(m => m.startsWith(word));
const DAY = `(?:${WEEKDAYS.join('|')})`;
// « vendredi soir », « demain matin »: the moment of the day is not part of the title.
const PERIOD = `(?:\\s(?:soir|matin|aprem|apres-midi))?`;
// « Rendre DM avant vendredi », « pour le 12/11 »: the deadline word goes with the date, not in the title.
const BEFORE = `(?:(?:avant|pour|d'ici)\\s)?`;

export interface ParsedQuickAdd {
  title: string;
  date: string | null;
  start: string | null;
  end: string | null;
  /** « tous les mardis », « chaque lundi »: only the next one is created (no repeating events yet). */
  weekly?: boolean;
}

const hm = (h: string | number, m?: string) => (Number(h) < 24 && Number(m ?? 0) < 60 ? `${String(h).padStart(2, '0')}:${m ?? '00'}` : null);

/** The date, or null when it doesn't exist (31/02, month 16…). */
function realDate(y: number, month: number, day: number) {
  const d = new Date(y, month, day);
  return month >= 0 && month < 12 && d.getMonth() === month && d.getDate() === day ? d : null;
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
  let weekly = false;
  // Same length as `text` (accents stripped, no trim) so match indices map back.
  // The typographic apostrophe of phone keyboards (« aujourd’hui ») counts as a plain one.
  const n = () => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'");

  const find = (re: RegExp) => n().match(re);
  const remove = (m: RegExpMatchArray) => {
    text = text.slice(0, m.index) + ' ' + text.slice(m.index! + m[0].length);
  };
  const cut = (re: RegExp) => {
    const m = find(re);
    if (m) remove(m);
    return m;
  };
  /** Same year, or next year when the date is more than a month ago. */
  const ahead = (d: Date | null, yearGiven: boolean) => {
    if (d && !yearGiven && differenceInCalendarDays(d, base) < -30) d.setFullYear(d.getFullYear() + 1);
    return d;
  };

  // Times: "14h", "14h30", "14:30", "de 14h à 16h", "14h-16h", "14h–16h" (dash of the autocorrect), "midi"
  const range = find(/\s(?:de\s)?(\d{1,2})\s?(?:h|:)\s?(\d{2})?\s?(?:-|–|—|a|à|jusqu'a)\s?(\d{1,2})\s?(?:h|:)\s?(\d{2})?(?=\s)/);
  if (range) {
    start = hm(range[1], range[2]);
    end = hm(range[3], range[4]);
    if (start) remove(range);
    if (!start || !end || end <= start) end = null; // « de 18h à 9h »: only the start makes sense
  }
  if (!start) {
    const t = find(/\s(?:a\s|vers\s)?(\d{1,2})\s?(?:h|:)\s?(\d{2})?(?=\s)/);
    if (t && (start = hm(t[1], t[2]))) remove(t);
  }
  // « ce midi » is today.
  let thisNoon = false;
  if (!start) {
    const t = cut(/\s(?:a\s|vers\s|(ce\s))?(midi|minuit)(?=\s)/);
    if (t) {
      start = t[2] === 'midi' ? '12:00' : '00:00';
      thisNoon = !!t[1];
    }
  }

  // Every week: the next one.
  const every = cut(new RegExp(`\\s(?:tous\\sles|chaque)\\s(${DAY})s?${PERIOD}(?=\\s)`));
  if (every) {
    weekly = true;
    date = addDays(base, (WEEKDAYS.indexOf(every[1]) - base.getDay() + 7) % 7);
  }

  // Relative days: "dans 5 jours", "dans une semaine", "demain", "la semaine prochaine"…
  const rel = !date && cut(/\sdans\s(\d{1,3}|une|deux|trois)\s(jours?|semaines?)(?=\s)/);
  if (rel) {
    const k = ({ une: 1, deux: 2, trois: 3 } as Record<string, number>)[rel[1]] ?? Number(rel[1]);
    date = addDays(base, rel[2].startsWith('semaine') ? k * 7 : k);
  } else if (date) {
    /* already found */
  } else if (cut(new RegExp(`\\s(?:apres-demain|apres demain)${PERIOD}(?=\\s)`))) date = addDays(base, 2);
  else if (cut(new RegExp(`\\sdemain${PERIOD}(?=\\s)`))) date = addDays(base, 1);
  else if (cut(new RegExp(`\\s(?:avant-hier|avant hier)${PERIOD}(?=\\s)`))) date = addDays(base, -2);
  else if (cut(new RegExp(`\\shier${PERIOD}(?=\\s)`))) date = addDays(base, -1);
  // « le contrôle d'aujourd'hui »: the « d' » goes with the day.
  else if (cut(/\s(?:d')?(?:aujourd'hui|aujourdhui)(?=\s)|\s(?:ce soir|ce matin|cet aprem|cet apres-midi)(?=\s)/) || thisNoon) date = base;
  else if (cut(/\s(?:la\s)?semaine\sprochaine(?=\s)/)) date = addDays(weekStart(base), 7);

  // dd/mm(/yyyy), with the day name that may come before: "mardi 3/11"
  if (!date) {
    const m = find(new RegExp(`\\s${BEFORE}(?:(?:le\\s)?${DAY}\\s)?(?:le\\s|du\\s)?(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2,4}))?${PERIOD}(?=\\s)`));
    if (m) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : base.getFullYear();
      date = ahead(realDate(y, Number(m[2]) - 1, Number(m[1])), !!m[3]);
      if (date) remove(m);
    }
  }

  // "12 novembre", "1er nov", "mardi 3 novembre 2026"
  if (!date) {
    const m = find(new RegExp(`\\s${BEFORE}(?:(?:le\\s)?${DAY}\\s)?(?:le\\s|du\\s)?(\\d{1,2})(?:er)?\\s(${MONTH_WORDS.join('|')})\\.?(?:\\s(\\d{4}))?${PERIOD}(?=\\s)`));
    if (m) {
      date = ahead(realDate(m[3] ? Number(m[3]) : base.getFullYear(), monthIndex(m[2]), Number(m[1])), !!m[3]);
      if (date) remove(m);
    }
  }

  // Weekday names: "vendredi" (the next one), "vendredi soir", "lundi prochain".
  // « Jeudi prochain » is the Thursday of next week (« ce jeudi » / « jeudi » is the coming one):
  // said on a Wednesday it is in 8 days, said on a Saturday « mardi prochain » is in 3 days.
  if (!date) {
    const m = cut(new RegExp(`\\s${BEFORE}(?:ce\\s|le\\s)?(${DAY})(\\sprochain)?${PERIOD}(?=\\s)`));
    if (m) {
      const target = WEEKDAYS.indexOf(m[1]);
      if (m[2]) date = addDays(weekStart(base), 7 + ((target + 6) % 7));
      else {
        let delta = (target - base.getDay() + 7) % 7;
        if (delta === 0) delta = 7;
        date = addDays(base, delta);
      }
    }
  }

  // A day number alone: « le 15 » is the next 15th (this month, or the next one when it's past).
  if (!date) {
    // Not the start of a range (« du 20 au 25 »): a single event can't hold it, the sentence stays as typed.
    const m = find(new RegExp(`\\s${BEFORE}(?:le|du)\\s(\\d{1,2})(?:er)?${PERIOD}(?=\\s)(?!\\s+(?:au|à|a|-|jusqu'au)\\s+\\d)`));
    const day = m ? Number(m[1]) : 0;
    if (m && day >= 1) {
      for (let k = 0; k < 3 && !date; k++) {
        const d = realDate(base.getFullYear(), base.getMonth() + k, day) ?? realDate(base.getFullYear() + 1, base.getMonth() + k - 12, day);
        if (d && differenceInCalendarDays(d, base) >= 0) date = d;
      }
      if (date) remove(m);
    }
  }

  const title = text
    .replace(/\s+/g, ' ')
    .replace(/\s(le|a|à|de|du|pour|avant)\s*$/i, '')
    .trim();

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    date: date && isValid(date) ? toKey(date) : null,
    start,
    end,
    ...(weekly && { weekly }),
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
