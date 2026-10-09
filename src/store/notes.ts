import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, nowIso, uniqueName } from '../lib/utils';
import { userStorage } from '../lib/userStorage';

export interface NoteFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string; // HTML (Tiptap)
  folderId: string | null;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotesState {
  folders: NoteFolder[];
  notes: Note[];
  createFolder: (name: string, parentId: string | null) => NoteFolder;
  renameFolder: (id: string, name: string) => void;
  removeFolder: (id: string) => void;
  moveFolder: (id: string, parentId: string | null) => void;
  createNote: (data?: Partial<Pick<Note, 'title' | 'content' | 'folderId'>>) => Note;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'folderId' | 'pinned'>>) => void;
  removeNote: (id: string) => void;
  duplicateNote: (id: string) => Note | null;
}

export function folderDescendants(folders: NoteFolder[], id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) {
    for (const f of folders) if (f.parentId === out[i]) out.push(f.id);
  }
  return out;
}

export const useNotes = create<NotesState>()(
  persist(
    (set, get) => ({
      folders: [],
      notes: [],

      createFolder(name, parentId) {
        const taken = get().folders.filter(f => f.parentId === parentId).map(f => f.name);
        const folder: NoteFolder = { id: uid(), name: uniqueName(name.trim() || 'Nouveau dossier', taken), parentId, createdAt: nowIso() };
        set(s => ({ folders: [...s.folders, folder] }));
        return folder;
      },

      renameFolder(id, name) {
        if (!name.trim()) return;
        set(s => ({ folders: s.folders.map(f => (f.id === id ? { ...f, name: name.trim() } : f)) }));
      },

      removeFolder(id) {
        const doomed = new Set(folderDescendants(get().folders, id));
        set(s => ({
          folders: s.folders.filter(f => !doomed.has(f.id)),
          notes: s.notes.filter(n => !n.folderId || !doomed.has(n.folderId)),
        }));
      },

      moveFolder(id, parentId) {
        if (parentId && folderDescendants(get().folders, id).includes(parentId)) return;
        set(s => ({ folders: s.folders.map(f => (f.id === id ? { ...f, parentId } : f)) }));
      },

      createNote(data = {}) {
        const time = nowIso();
        const note: Note = {
          id: uid(),
          title: data.title?.trim() || 'Sans titre',
          content: data.content ?? '',
          folderId: data.folderId ?? null,
          createdAt: time,
          updatedAt: time,
        };
        set(s => ({ notes: [...s.notes, note] }));
        return note;
      },

      updateNote: (id, patch) =>
        set(s => ({ notes: s.notes.map(n => (n.id === id ? { ...n, ...patch, updatedAt: nowIso() } : n)) })),

      removeNote: id => set(s => ({ notes: s.notes.filter(n => n.id !== id) })),

      duplicateNote(id) {
        const src = get().notes.find(n => n.id === id);
        if (!src) return null;
        return get().createNote({ title: `${src.title} - copie`, content: src.content, folderId: src.folderId });
      },
    }),
    { name: 'notes', storage: userStorage, skipHydration: true },
  ),
);
