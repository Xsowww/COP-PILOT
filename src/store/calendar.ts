import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, nowIso } from '../lib/utils';
import { userStorage } from '../lib/userStorage';

export type EventCategory = 'cours' | 'examen' | 'devoir' | 'perso' | 'sport';

export const CATEGORIES: Record<EventCategory, { label: string; emoji: string; color: string; soft: string; text: string }> = {
  cours: { label: 'Cours', emoji: '📚', color: '#3b82f6', soft: '#eff6ff', text: '#1d4ed8' },
  examen: { label: 'Examen', emoji: '🎯', color: '#ef4444', soft: '#fef2f2', text: '#b91c1c' },
  devoir: { label: 'Devoir', emoji: '✏️', color: '#f59e0b', soft: '#fffbeb', text: '#b45309' },
  perso: { label: 'Perso', emoji: '🌿', color: '#10b981', soft: '#ecfdf5', text: '#047857' },
  sport: { label: 'Sport', emoji: '⚡', color: '#8b5cf6', soft: '#f5f3ff', text: '#6d28d9' },
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
  createdAt: string;
}

export type NewEvent = Omit<CalendarEvent, 'id' | 'done' | 'createdAt'>;

interface CalendarState {
  events: CalendarEvent[];
  add: (e: NewEvent) => CalendarEvent;
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
      update: (id, patch) => set(s => ({ events: s.events.map(e => (e.id === id ? { ...e, ...patch } : e)) })),
      remove: id => set(s => ({ events: s.events.filter(e => e.id !== id) })),
      toggleDone: id => set(s => ({ events: s.events.map(e => (e.id === id ? { ...e, done: !e.done } : e)) })),
    }),
    { name: 'calendar', storage: userStorage, skipHydration: true },
  ),
);
