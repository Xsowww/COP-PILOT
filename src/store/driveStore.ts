import { create } from 'zustand';
import type { DriveFile, FileType } from '../types';

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function now() {
  return new Date().toISOString();
}

const DEMO_FILES: DriveFile[] = [
  { id: 'f1', name: 'Cours', type: 'folder', parentId: null, createdAt: now(), updatedAt: now() },
  { id: 'f2', name: 'Mathématiques', type: 'folder', parentId: 'f1', createdAt: now(), updatedAt: now() },
  { id: 'f3', name: 'Physique', type: 'folder', parentId: 'f1', createdAt: now(), updatedAt: now() },
  { id: 'f4', name: 'Projet', type: 'folder', parentId: null, createdAt: now(), updatedAt: now() },
  { id: 'f5', name: 'Cours_Intégrales.pdf', type: 'pdf', size: 2048000, parentId: 'f2', createdAt: now(), updatedAt: now() },
  { id: 'f6', name: 'Formules_Physique.pdf', type: 'pdf', size: 1024000, parentId: 'f3', createdAt: now(), updatedAt: now() },
  { id: 'f7', name: 'Schéma_Circuit.png', type: 'image', size: 512000, parentId: 'f3', createdAt: now(), updatedAt: now() },
];

interface DriveState {
  files: DriveFile[];
  currentFolderId: string | null;
  selectedFileId: string | null;
  previewFile: DriveFile | null;
  addFile: (name: string, type: FileType, parentId: string | null, url?: string, size?: number) => DriveFile;
  addFolder: (name: string, parentId: string | null) => DriveFile;
  deleteFile: (id: string) => void;
  setCurrentFolder: (id: string | null) => void;
  setSelectedFile: (id: string | null) => void;
  setPreviewFile: (file: DriveFile | null) => void;
  getFilesInFolder: (parentId: string | null) => DriveFile[];
  getRecentFiles: (limit?: number) => DriveFile[];
  getBreadcrumbs: (folderId: string | null) => DriveFile[];
  linkNoteToFile: (fileId: string, noteId: string) => void;
  linkEventToFile: (fileId: string, eventId: string) => void;
}

export const useDriveStore = create<DriveState>((set, get) => ({
  files: DEMO_FILES,
  currentFolderId: null,
  selectedFileId: null,
  previewFile: null,

  addFile: (name, type, parentId, url, size) => {
    const file: DriveFile = {
      id: generateId(),
      name,
      type,
      size,
      parentId,
      url,
      createdAt: now(),
      updatedAt: now(),
      linkedNoteIds: [],
      linkedEventIds: [],
    };
    set(s => ({ files: [...s.files, file] }));
    return file;
  },

  addFolder: (name, parentId) => {
    const folder: DriveFile = {
      id: generateId(),
      name,
      type: 'folder',
      parentId,
      createdAt: now(),
      updatedAt: now(),
    };
    set(s => ({ files: [...s.files, folder] }));
    return folder;
  },

  deleteFile: (id) => {
    set(s => ({ files: s.files.filter(f => f.id !== id && f.parentId !== id) }));
  },

  setCurrentFolder: (id) => set({ currentFolderId: id }),
  setSelectedFile: (id) => set({ selectedFileId: id }),
  setPreviewFile: (file) => set({ previewFile: file }),

  getFilesInFolder: (parentId) => {
    return get().files.filter(f => f.parentId === parentId);
  },

  getRecentFiles: (limit = 5) => {
    return [...get().files]
      .filter(f => f.type !== 'folder')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  },

  getBreadcrumbs: (folderId) => {
    const crumbs: DriveFile[] = [];
    let current = folderId;
    while (current) {
      const folder = get().files.find(f => f.id === current);
      if (!folder) break;
      crumbs.unshift(folder);
      current = folder.parentId;
    }
    return crumbs;
  },

  linkNoteToFile: (fileId, noteId) => {
    set(s => ({
      files: s.files.map(f =>
        f.id === fileId
          ? { ...f, linkedNoteIds: [...(f.linkedNoteIds || []), noteId] }
          : f
      ),
    }));
  },

  linkEventToFile: (fileId, eventId) => {
    set(s => ({
      files: s.files.map(f =>
        f.id === fileId
          ? { ...f, linkedEventIds: [...(f.linkedEventIds || []), eventId] }
          : f
      ),
    }));
  },
}));
