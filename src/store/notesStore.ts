import { create } from 'zustand';
import type { Note } from '../types';

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function now() {
  return new Date().toISOString();
}

const DEMO_NOTES: Note[] = [
  {
    id: 'n1',
    title: 'Révisions Génétique',
    content: '<h2>La Génétique</h2><p>La <strong>génétique</strong> est l\'étude des gènes et de l\'hérédité. Les principaux concepts à retenir :</p><ul><li>ADN et structure de la double hélice</li><li>Transcription et traduction</li><li>Mutations génétiques</li></ul>',
    createdAt: now(),
    updatedAt: now(),
    linkedFileIds: [],
    linkedEventIds: ['e1'],
  },
  {
    id: 'n2',
    title: 'Notes TP Physique',
    content: '<h2>TP – Indice de Réfraction</h2><p>Expérience du <em>dioptre plan</em>. On mesure les angles d\'incidence et de réfraction pour retrouver l\'indice n du milieu.</p><p>Formule de Snell-Descartes : <strong>n₁ sin θ₁ = n₂ sin θ₂</strong></p>',
    createdAt: now(),
    updatedAt: now(),
    linkedFileIds: ['f6'],
    linkedEventIds: ['e2'],
  },
  {
    id: 'n3',
    title: 'Idées projet groupe',
    content: '<h2>Brainstorming</h2><ul><li>Application mobile de révisions</li><li>Site de partage de cours</li><li>Bot Discord pour les devoirs</li></ul>',
    createdAt: now(),
    updatedAt: now(),
    linkedFileIds: [],
    linkedEventIds: [],
  },
];

interface NotesState {
  notes: Note[];
  activeNoteId: string | null;
  createNote: (title?: string) => Note;
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content'>>) => void;
  deleteNote: (id: string) => void;
  setActiveNote: (id: string | null) => void;
  getActiveNote: () => Note | null;
  linkFileToNote: (noteId: string, fileId: string) => void;
  linkEventToNote: (noteId: string, eventId: string) => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: DEMO_NOTES,
  activeNoteId: 'n1',

  createNote: (title = 'Nouvelle note') => {
    const note: Note = {
      id: generateId(),
      title,
      content: '',
      createdAt: now(),
      updatedAt: now(),
      linkedFileIds: [],
      linkedEventIds: [],
    };
    set(s => ({ notes: [...s.notes, note], activeNoteId: note.id }));
    return note;
  },

  updateNote: (id, updates) => {
    set(s => ({
      notes: s.notes.map(n =>
        n.id === id ? { ...n, ...updates, updatedAt: now() } : n
      ),
    }));
  },

  deleteNote: (id) => {
    set(s => {
      const remaining = s.notes.filter(n => n.id !== id);
      return {
        notes: remaining,
        activeNoteId: s.activeNoteId === id ? (remaining[0]?.id ?? null) : s.activeNoteId,
      };
    });
  },

  setActiveNote: (id) => set({ activeNoteId: id }),

  getActiveNote: () => {
    const { notes, activeNoteId } = get();
    return notes.find(n => n.id === activeNoteId) ?? null;
  },

  linkFileToNote: (noteId, fileId) => {
    set(s => ({
      notes: s.notes.map(n =>
        n.id === noteId
          ? { ...n, linkedFileIds: [...(n.linkedFileIds || []), fileId] }
          : n
      ),
    }));
  },

  linkEventToNote: (noteId, eventId) => {
    set(s => ({
      notes: s.notes.map(n =>
        n.id === noteId
          ? { ...n, linkedEventIds: [...(n.linkedEventIds || []), eventId] }
          : n
      ),
    }));
  },
}));
