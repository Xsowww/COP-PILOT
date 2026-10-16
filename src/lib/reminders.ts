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
const MAX_MINUTES = 10080 * 4;

export const reminderOptions = (timed: boolean) => (timed ? TIMED_OPTIONS : DAY_OPTIONS);

/** An event's reminders: its own, else the usual ones (Profil › Notifications) when it has a time and was made here. */
export const eventReminders = (e: { reminders?: number[]; start?: string; externalId?: string }, defaults: number[]) =>
  e.reminders ?? (e.start && !e.externalId ? defaults : []);

/** The label of a reminder (an option, or « 3 h avant » for any other value). */
export function reminderLabel(minutes: number, timed: boolean): string {
  const o = reminderOptions(timed).find(x => x.minutes === minutes);
  if (o) return o.label;
  if (minutes % 1440 === 0) return `${minutes / 1440} j avant`;
  if (minutes % 60 === 0) return `${minutes / 60} h avant`;
  return `${minutes} min avant`;
}

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

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}h${pad(d.getMinutes())}`.replace(/h00$/, 'h');

/** « Dans 15 min, à 14h », « Demain à 9h30 », « Aujourd’hui », « Dans 2 jours »… as seen when it fires. */
export function reminderBody(src: ReminderSource, fireAt: Date): string {
  const at = anchorOf(src.date!, src.time);
  const timed = !!src.time;
  const minutes = Math.round((at.getTime() - fireAt.getTime()) / 60_000);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(at) - day(fireAt)) / 86_400_000);
  const what = src.kind === 'task' ? 'À faire' : '';
  if (timed) {
    if (minutes <= 0) return src.kind === 'task' ? `À faire maintenant (${hhmm(at)})` : `Maintenant, à ${hhmm(at)}`;
    if (minutes < 60) return `Dans ${minutes} min, à ${hhmm(at)}`;
    if (days === 0) return `Aujourd’hui à ${hhmm(at)}`;
    if (days === 1) return `Demain à ${hhmm(at)}`;
    return `Dans ${days} jours, à ${hhmm(at)}`;
  }
  const when = days <= 0 ? 'aujourd’hui' : days === 1 ? 'demain' : days === 7 ? 'dans une semaine' : `dans ${days} jours`;
  return what ? `${what} ${when}` : when.charAt(0).toUpperCase() + when.slice(1);
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

/** When an item gains or loses its time: the reminders that still make sense, else `fallback`. */
export function adaptReminders(list: number[], timed: boolean, fallback: number[]): number[] {
  const valid = new Set(reminderOptions(timed).map(o => o.minutes));
  const kept = list.filter(m => valid.has(m));
  return kept.length || !list.length ? kept : fallback;
}
