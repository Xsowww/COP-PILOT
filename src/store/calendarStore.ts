import { create } from 'zustand';
import type { CalendarEvent } from '../types';
import { format, addDays } from 'date-fns';

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function today() {
  return format(new Date(), 'yyyy-MM-dd');
}

const DEMO_EVENTS: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Examen de Biologie',
    description: 'Chapitres 4 à 7 – Génétique et évolution',
    date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '11:00',
    priority: 'exam',
    done: false,
    linkedFileIds: [],
    linkedNoteIds: [],
  },
  {
    id: 'e2',
    title: 'TP Physique',
    description: 'Mesure de l\'indice de réfraction',
    date: today(),
    startTime: '14:00',
    endTime: '16:00',
    priority: 'high',
    done: false,
  },
  {
    id: 'e3',
    title: 'Réunion de projet',
    date: today(),
    startTime: '10:00',
    endTime: '11:00',
    priority: 'medium',
    done: true,
  },
  {
    id: 'e4',
    title: 'Cours de Maths',
    date: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
    startTime: '08:00',
    endTime: '10:00',
    priority: 'medium',
    done: false,
  },
  {
    id: 'e5',
    title: 'Rendu dossier Histoire',
    date: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
    priority: 'high',
    done: false,
  },
];

type CalendarView = 'month' | 'week' | 'day';

interface CalendarState {
  events: CalendarEvent[];
  currentDate: Date;
  view: CalendarView;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => CalendarEvent;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  toggleDone: (id: string) => void;
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarView) => void;
  getEventsForDate: (date: string) => CalendarEvent[];
  getTodayEvents: () => CalendarEvent[];
  linkFileToEvent: (eventId: string, fileId: string) => void;
  linkNoteToEvent: (eventId: string, noteId: string) => void;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: DEMO_EVENTS,
  currentDate: new Date(),
  view: 'month',

  addEvent: (event) => {
    const newEvent: CalendarEvent = { ...event, id: generateId() };
    set(s => ({ events: [...s.events, newEvent] }));
    return newEvent;
  },

  updateEvent: (id, updates) => {
    set(s => ({ events: s.events.map(e => e.id === id ? { ...e, ...updates } : e) }));
  },

  deleteEvent: (id) => {
    set(s => ({ events: s.events.filter(e => e.id !== id) }));
  },

  toggleDone: (id) => {
    set(s => ({
      events: s.events.map(e => e.id === id ? { ...e, done: !e.done } : e),
    }));
  },

  setCurrentDate: (date) => set({ currentDate: date }),
  setView: (view) => set({ view }),

  getEventsForDate: (date) => {
    return get().events.filter(e => e.date === date);
  },

  getTodayEvents: () => {
    return get().events.filter(e => e.date === today()).sort((a, b) => {
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return a.startTime.localeCompare(b.startTime);
    });
  },

  linkFileToEvent: (eventId, fileId) => {
    set(s => ({
      events: s.events.map(e =>
        e.id === eventId
          ? { ...e, linkedFileIds: [...(e.linkedFileIds || []), fileId] }
          : e
      ),
    }));
  },

  linkNoteToEvent: (eventId, noteId) => {
    set(s => ({
      events: s.events.map(e =>
        e.id === eventId
          ? { ...e, linkedNoteIds: [...(e.linkedNoteIds || []), noteId] }
          : e
      ),
    }));
  },
}));
