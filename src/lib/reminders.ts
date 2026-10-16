// Reminders of events and tasks: when they fire and what they say. Pure functions (tested in tests/reminders.test.ts);
// the scheduling lives in lib/reminderScheduler.ts and the sending in server/push.mjs.
//
// A reminder is a number of minutes before the item's moment: its start time, or 9:00 that day for an
// event without a time or a task without a time (« la veille, 18 h » = 15 h before 9:00).

export interface ReminderOption {
  minutes: number;
  label: string;
}

/** For an item with a time. */
export const TIMED_OPTIONS: ReminderOption[] = [
  { minutes: 0, label: 'À l’heure' },
  { minutes: 5, label: '5 min avant' },
  { minutes: 15, label: '15 min avant' },
  { minutes: 30, label: '30 min avant' },
  { minutes: 60, label: '1 h avant' },
  { minutes: 120, label: '2 h avant' },
  { minutes: 1440, label: '1 jour avant' },
  { minutes: 2880, label: '2 jours avant' },
  { minutes: 10080, label: '1 semaine avant' },
];

/** For an item without a time (all day): relative to 9:00 that day. */
export const DAY_OPTIONS: ReminderOption[] = [
  { minutes: 0, label: 'Le jour même, 9 h' },
  { minutes: 900, label: 'La veille, 18 h' },
  { minutes: 2880, label: '2 jours avant, 9 h' },
  { minutes: 10080, label: '1 semaine avant, 9 h' },
];

export const DAY_ANCHOR = '09:00';

const pad = (n: number) => String(n).padStart(2, '0');
/** « 9h », « 14h30 ». */
const hhmm = (d: Date) => `${d.getHours()}h${pad(d.getMinutes())}`.replace(/h00$/, 'h');
/** 4 weeks: the furthest a reminder can be before its item. */
export const MAX_MINUTES = 10080 * 4;

export const reminderOptions = (timed: boolean) => (timed ? TIMED_OPTIONS : DAY_OPTIONS);

/** An event's reminders: its own, else the usual ones (Profil › Notifications) when it has a time and was made here. */
export const eventReminders = (e: { reminders?: number[]; start?: string; externalId?: string }, defaults: number[]) =>
  e.reminders ?? (e.start && !e.externalId ? defaults : []);

/** « 45 min avant », « 3 h 30 avant », « 2 j 4 h avant ». */
export function offsetLabel(minutes: number): string {
  if (minutes === 0) return 'À l’heure';
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const parts = [d && `${d} j`, h && `${h} h`, m && (d || h ? String(m).padStart(2, '0') : `${m} min`)].filter(Boolean);
  return `${parts.join(' ')} avant`;
}

/** The moment a reminder fires, in local time. */
export const reminderMoment = (date: string, time: string | undefined, minutes: number) => new Date(anchorOf(date, time).getTime() - minutes * 60_000);

/**
 * The label of a reminder: an option's, else, when the item's date is known, the moment itself
 * (« La veille à 20h30 », « Le jour même à 7h », « Lun. 13 oct. à 18h »), else the time before it.
 */
export function reminderLabel(minutes: number, timed: boolean, date?: string, time?: string): string {
  const o = reminderOptions(timed).find(x => x.minutes === minutes);
  if (o) return o.label;
  if (!date) return offsetLabel(minutes);
  const at = reminderMoment(date, time, minutes);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(anchorOf(date, time)) - day(at)) / 86_400_000);
  const when = days === 0 ? 'Le jour même' : days === 1 ? 'La veille' : `${WEEKDAYS[at.getDay()]} ${at.getDate()} ${MONTHS[at.getMonth()]}`;
  return `${when} à ${hhmm(at)}`;
}
const WEEKDAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Keeps valid, distinct values, sorted (biggest first). [] = « no reminder » chosen; undefined = never chosen. */
export function cleanReminders(list: unknown): number[] | undefined {
  if (!Array.isArray(list)) return undefined;
  return [...new Set(list.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= MAX_MINUTES))].sort((a, b) => b - a).slice(0, 10);
}

/** The moment of an item, in local time: its date at its time, or 9:00. */
export function anchorOf(date: string, time?: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = (time && /^\d{2}:\d{2}$/.test(time) ? time : DAY_ANCHOR).split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

export interface ReminderSource {
  kind: 'event' | 'task';
  id: string;
  title: string;
  date?: string;
  time?: string;
  /** End time of an event (HH:mm), shown in the notification. */
  end?: string;
  done?: boolean;
  reminders?: number[];
}

export interface DueReminder {
  /** Stable for one item, one reminder and one moment: what is already sent or shown is never repeated. */
  key: string;
  fireAt: Date;
  title: string;
  body: string;
  url: string;
}


const WEEKDAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/**
 * What a notification says under its title, as seen when it fires — line 1: when (« Dans 15 min · 14h – 15h30 »,
 * « Demain · 9h30 », « À faire aujourd’hui »); line 2: where it comes from (« Agenda · Kompaly »).
 */
export function reminderBody(src: ReminderSource, fireAt: Date): string {
  const at = anchorOf(src.date!, src.time);
  const minutes = Math.round((at.getTime() - fireAt.getTime()) / 60_000);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(at) - day(fireAt)) / 86_400_000);
  const task = src.kind === 'task';
  const dayName = days <= 0 ? 'aujourd’hui' : days === 1 ? 'demain' : `${WEEKDAY_NAMES[at.getDay()].toLowerCase()} ${at.getDate()} ${MONTHS[at.getMonth()]}`;
  let when: string;
  if (src.time) {
    const end = src.end && /^\d{2}:\d{2}$/.test(src.end) && src.end > src.time ? ` – ${hhmm(anchorOf(src.date!, src.end))}` : '';
    const hours = `${hhmm(at)}${end}`;
    const rel = minutes <= 0 ? 'maintenant' : minutes < 60 ? `dans ${minutes} min` : dayName;
    when = `${task ? 'À faire ' : ''}${rel} · ${hours}`;
  } else {
    when = task ? `À faire ${dayName}` : dayName;
  }
  const line1 = when.charAt(0).toUpperCase() + when.slice(1);
  return `${line1}\n${task ? 'Tâches' : 'Agenda'} · Kompaly`;
}

/** The reminders still to come, from now up to `horizonDays`, soonest first. */
export function upcomingReminders(items: ReminderSource[], now = new Date(), horizonDays = 35): DueReminder[] {
  const until = now.getTime() + horizonDays * 86_400_000;
  const out: DueReminder[] = [];
  for (const src of items) {
    if (src.done || !src.date || !src.reminders?.length) continue;
    const at = anchorOf(src.date, src.time);
    for (const m of src.reminders) {
      const fireAt = new Date(at.getTime() - m * 60_000);
      if (fireAt.getTime() <= now.getTime() - 60_000 || fireAt.getTime() > until) continue;
      out.push({
        key: `${src.kind}:${src.id}:${m}:${src.date}T${src.time ?? DAY_ANCHOR}`,
        fireAt,
        title: src.title.trim().slice(0, 200) || (src.kind === 'task' ? 'Tâche' : 'Événement'),
        body: reminderBody(src, fireAt).slice(0, 300),
        url: src.kind === 'task' ? '/taches' : `/calendrier?jour=${src.date}`,
      });
    }
  }
  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/** When an item gains or loses its time: the reminders that still make sense (custom ones stay), else `fallback`. */
export function adaptReminders(list: number[], timed: boolean, fallback: number[]): number[] {
  const valid = new Set(reminderOptions(timed).map(o => o.minutes));
  const before = new Set(reminderOptions(!timed).map(o => o.minutes));
  const kept = list.filter(m => valid.has(m) || !before.has(m));
  return kept.length || !list.length ? kept : fallback;
}
