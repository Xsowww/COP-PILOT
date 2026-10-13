import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, nowIso } from '../lib/utils';
import { userStorage } from '../lib/userStorage';

export type EventCategory = 'cours' | 'examen' | 'devoir' | 'perso' | 'sport';

/** Colours: `color` is a plain hex; `soft`/`text` are CSS variables (light and dark values in index.css). */
export const CATEGORIES: Record<EventCategory, { label: string; color: string; soft: string; text: string }> = {
  cours: { label: 'Cours', color: '#3b6fd8', soft: 'var(--cat-cours-soft)', text: 'var(--cat-cours-text)' },
  examen: { label: 'Examen', color: '#d9483b', soft: 'var(--cat-examen-soft)', text: 'var(--cat-examen-text)' },
  devoir: { label: 'Devoir', color: '#d48a17', soft: 'var(--cat-devoir-soft)', text: 'var(--cat-devoir-text)' },
  perso: { label: 'Perso', color: '#2f9e6b', soft: 'var(--cat-perso-soft)', text: 'var(--cat-perso-text)' },
  sport: { label: 'Sport', color: '#7a5ad6', soft: 'var(--cat-sport-soft)', text: 'var(--cat-sport-text)' },
};

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  start?: string; // HH:mm
  end?: string;
  category: EventCategory;
  done: boolean;
  details?: string;
  /** UID of the event in an imported .ics file, so a second import doesn't duplicate it. */
  externalId?: string;
  createdAt: string;
}

export type NewEvent = Omit<CalendarEvent, 'id' | 'done' | 'createdAt'>;

interface CalendarState {
  events: CalendarEvent[];
  add: (e: NewEvent) => CalendarEvent;
  /** Adds many events in one update (.ics import). */
  addMany: (list: NewEvent[]) => void;
  update: (id: string, patch: Partial<CalendarEvent>) => void;
  remove: (id: string) => void;
  toggleDone: (id: string) => void;
}

/** Guess a category from the title so the student never has to think about it. */
export function guessCategory(title: string): EventCategory {
  const t = title.toLowerCase();
  if (/(exam|partiel|contr[oô]le|\bds\b|\bqcm\b|interro|oral|soutenance|concours)/.test(t)) return 'examen';
  if (/(devoir|\btp\b|\btd\b|rendre|rendu|dm\b|projet|dossier|exo|exercice|r[ée]vis)/.test(t)) return 'devoir';
  if (/(sport|foot|basket|gym|muscu|course|piscine|natation|yoga|tennis|danse)/.test(t)) return 'sport';
  if (/(cours|amphi|cm\b|lecture|classe|prof|math|physique|chimie|histoire|anglais|fran[cç]ais|info|bio|[ée]co|philo)/.test(t)) return 'cours';
  return 'perso';
}

export const sortEvents = (a: CalendarEvent, b: CalendarEvent) =>
  a.date.localeCompare(b.date) || (a.start ?? '99').localeCompare(b.start ?? '99');

export const useCalendar = create<CalendarState>()(
  persist(
    set => ({
      events: [],
      add(e) {
        const ev: CalendarEvent = { ...e, id: uid(), done: false, createdAt: nowIso() };
        set(s => ({ events: [...s.events, ev] }));
        return ev;
      },
      addMany: list => set(s => ({ events: [...s.events, ...list.map(e => ({ ...e, id: uid(), done: false, createdAt: nowIso() }))] })),
      update: (id, patch) => set(s => ({ events: s.events.map(e => (e.id === id ? { ...e, ...patch } : e)) })),
      remove: id => set(s => ({ events: s.events.filter(e => e.id !== id) })),
      toggleDone: id => set(s => ({ events: s.events.map(e => (e.id === id ? { ...e, done: !e.done } : e)) })),
    }),
    { name: 'calendar', storage: userStorage, skipHydration: true },
  ),
);
