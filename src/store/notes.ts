import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, nowIso, uniqueName } from '../lib/utils';
import { userStorage } from '../lib/userStorage';
import { TRASH_DAYS } from './drive';

export interface NoteFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  deletedAt?: string;
}

/** A note can point to Drive files and calendar events (« Partiel de chimie » → its PDFs). */
export interface NoteLink {
  kind: 'file' | 'event';
  id: string;
}

export interface Note {
  id: string;
  title: string;
  content: string; // HTML (Tiptap)
  folderId: string | null;
  pinned?: boolean;
  links?: NoteLink[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

interface NotesState {
  folders: NoteFolder[];
  notes: Note[];
  /** Deleted folders and notes, kept TRASH_DAYS days (separate lists: nothing else has to filter them). */
  trashFolders: NoteFolder[];
  trashNotes: Note[];
  createFolder: (name: string, parentId: string | null) => NoteFolder;
  renameFolder: (id: string, name: string) => void;
  removeFolder: (id: string) => void;
  moveFolder: (id: string, parentId: string | null) => void;
  createNote: (data?: Partial<Pick<Note, 'title' | 'content' | 'folderId'>>) => Note;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'folderId' | 'pinned' | 'links'>>) => void;
  removeNote: (id: string) => void;
  duplicateNote: (id: string) => Note | null;
  /** Restores trashed notes / folders (with what was deleted together with them). */
  restore: (ids: string[]) => void;
  /** Deletes trashed notes / folders for good. */
  purge: (ids: string[]) => void;
  emptyTrash: () => void;
  purgeExpired: () => void;
}

export function folderDescendants(folders: NoteFolder[], id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) {
    for (const f of folders) if (f.parentId === out[i]) out.push(f.id);
  }
  return out;
}

/** Trashed folders / notes shown at the top level of the trash. */
export function notesTrashRoots(trashFolders: NoteFolder[], trashNotes: Note[]) {
  const inTrash = new Set(trashFolders.map(f => f.id));
  return {
    folders: trashFolders.filter(f => !f.parentId || !inTrash.has(f.parentId)),
    notes: trashNotes.filter(n => !n.folderId || !inTrash.has(n.folderId)),
  };
}

export const useNotes = create<NotesState>()(
  persist(
    (set, get) => ({
      folders: [],
      notes: [],
      trashFolders: [],
      trashNotes: [],

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
        const deletedAt = nowIso();
        set(s => ({
          folders: s.folders.filter(f => !doomed.has(f.id)),
          notes: s.notes.filter(n => !n.folderId || !doomed.has(n.folderId)),
          trashFolders: [...s.trashFolders, ...s.folders.filter(f => doomed.has(f.id)).map(f => ({ ...f, deletedAt }))],
          trashNotes: [...s.trashNotes, ...s.notes.filter(n => n.folderId && doomed.has(n.folderId)).map(n => ({ ...n, deletedAt }))],
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

      removeNote: id =>
        set(s => {
          const note = s.notes.find(n => n.id === id);
          if (!note) return s;
          return { notes: s.notes.filter(n => n.id !== id), trashNotes: [...s.trashNotes, { ...note, deletedAt: nowIso() }] };
        }),

      restore(ids) {
        const { trashFolders, trashNotes, folders } = get();
        const backF = new Set<string>();
        const backN = new Set<string>();
        for (const id of ids) {
          const note = trashNotes.find(n => n.id === id);
          if (note) backN.add(id);
          const folder = trashFolders.find(f => f.id === id);
          if (!folder) continue;
          // The folder, its sub-folders and notes deleted at the same time.
          for (const fid of folderDescendants(trashFolders, id)) {
            if (trashFolders.find(f => f.id === fid)?.deletedAt === folder.deletedAt) backF.add(fid);
          }
          for (const n of trashNotes) if (n.folderId && backF.has(n.folderId) && n.deletedAt === folder.deletedAt) backN.add(n.id);
        }
        const alive = (fid: string | null) => !fid || backF.has(fid) || folders.some(f => f.id === fid);
        const strip = <T extends { deletedAt?: string }>({ deletedAt: _d, ...rest }: T) => rest;
        set(s => ({
          folders: [...s.folders, ...s.trashFolders.filter(f => backF.has(f.id)).map(f => ({ ...strip(f), parentId: alive(f.parentId) ? f.parentId : null }))],
          notes: [...s.notes, ...s.trashNotes.filter(n => backN.has(n.id)).map(n => ({ ...strip(n), folderId: alive(n.folderId) ? n.folderId : null }))],
          trashFolders: s.trashFolders.filter(f => !backF.has(f.id)),
          trashNotes: s.trashNotes.filter(n => !backN.has(n.id)),
        }));
      },

      purge(ids) {
        const { trashFolders } = get();
        const doomedF = new Set(ids.filter(id => trashFolders.some(f => f.id === id)).flatMap(id => folderDescendants(trashFolders, id)));
        const doomedN = new Set(ids);
        set(s => ({
          trashFolders: s.trashFolders.filter(f => !doomedF.has(f.id)),
          trashNotes: s.trashNotes.filter(n => !doomedN.has(n.id) && !(n.folderId && doomedF.has(n.folderId))),
        }));
      },

      emptyTrash: () => set({ trashFolders: [], trashNotes: [] }),

      purgeExpired() {
        const limit = Date.now() - TRASH_DAYS * 864e5;
        const old = (x: { deletedAt?: string }) => !!x.deletedAt && new Date(x.deletedAt).getTime() < limit;
        const ids = [...get().trashFolders.filter(old), ...get().trashNotes.filter(old)].map(x => x.id);
        if (ids.length) get().purge(ids);
      },

      duplicateNote(id) {
        const src = get().notes.find(n => n.id === id);
        if (!src) return null;
        return get().createNote({ title: `${src.title} - copie`, content: src.content, folderId: src.folderId });
      },
    }),
    { name: 'notes', storage: userStorage, skipHydration: true },
  ),
);
