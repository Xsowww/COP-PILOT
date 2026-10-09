import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, nowIso, uniqueName } from '../lib/utils';
import { userStorage, blobKey } from '../lib/userStorage';
import { blobStore } from '../lib/blobStore';

export type DriveKind = 'folder' | 'file';

export interface DriveItem {
  id: string;
  name: string;
  kind: DriveKind;
  parentId: string | null;
  mime?: string;
  size?: number;
  createdAt: string;
  updatedAt: string;
  starred?: boolean;
}

export interface Clipboard {
  mode: 'copy' | 'cut';
  ids: string[];
}

interface DriveState {
  items: DriveItem[];
  clipboard: Clipboard | null;
  createFolder: (name: string, parentId: string | null) => DriveItem;
  uploadFiles: (files: File[], parentId: string | null) => Promise<DriveItem[]>;
  rename: (id: string, name: string) => void;
  remove: (ids: string[]) => void;
  move: (ids: string[], targetId: string | null) => number;
  duplicate: (ids: string[]) => Promise<void>;
  copy: (ids: string[]) => void;
  cut: (ids: string[]) => void;
  paste: (targetId: string | null) => Promise<void>;
  toggleStar: (id: string) => void;
}

export const childrenOf = (items: DriveItem[], parentId: string | null) =>
  items
    .filter(i => i.parentId === parentId)
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'fr') : a.kind === 'folder' ? -1 : 1));

/** ids + all their descendants */
export function withDescendants(items: DriveItem[], ids: string[]): string[] {
  const out = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const i of items) {
      if (i.parentId && out.has(i.parentId) && !out.has(i.id)) {
        out.add(i.id);
        grew = true;
      }
    }
  }
  return [...out];
}

export function pathOf(items: DriveItem[], id: string | null): DriveItem[] {
  const path: DriveItem[] = [];
  let cur = items.find(i => i.id === id);
  while (cur) {
    path.unshift(cur);
    const parent: string | null = cur.parentId;
    cur = items.find(i => i.id === parent);
  }
  return path;
}

export const folderSize = (items: DriveItem[], id: string) =>
  withDescendants(items, [id]).reduce((sum, i) => sum + (items.find(x => x.id === i)?.size ?? 0), 0);

const siblingNames = (items: DriveItem[], parentId: string | null, exceptId?: string) =>
  items.filter(i => i.parentId === parentId && i.id !== exceptId).map(i => i.name);

/** Deep copy of `ids` into `targetId`; returns new items and blob copies to perform. */
function cloneTree(items: DriveItem[], ids: string[], targetId: string | null, keepName: boolean) {
  const created: DriveItem[] = [];
  const blobCopies: [string, string][] = [];
  const time = nowIso();
  const cloneOne = (src: DriveItem, parentId: string | null, rename: boolean) => {
    const pool = [...items, ...created];
    const base = rename && !keepName ? copyName(src.name) : src.name;
    const copy: DriveItem = {
      ...src,
      id: uid(),
      parentId,
      name: uniqueName(base, siblingNames(pool, parentId)),
      createdAt: time,
      updatedAt: time,
      starred: false,
    };
    created.push(copy);
    if (src.kind === 'file') blobCopies.push([src.id, copy.id]);
    for (const child of items.filter(i => i.parentId === src.id)) cloneOne(child, copy.id, false);
  };
  for (const id of ids) {
    const src = items.find(i => i.id === id);
    if (src) cloneOne(src, targetId, true);
  }
  return { created, blobCopies };
}

function copyName(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)} - copie${name.slice(dot)}` : `${name} - copie`;
}

export const useDrive = create<DriveState>()(
  persist(
    (set, get) => ({
      items: [],
      clipboard: null,

      createFolder(name, parentId) {
        const time = nowIso();
        const folder: DriveItem = {
          id: uid(),
          name: uniqueName(name.trim() || 'Nouveau dossier', siblingNames(get().items, parentId)),
          kind: 'folder',
          parentId,
          createdAt: time,
          updatedAt: time,
        };
        set(s => ({ items: [...s.items, folder] }));
        return folder;
      },

      async uploadFiles(files, parentId) {
        const created: DriveItem[] = [];
        for (const file of files) {
          const time = nowIso();
          const item: DriveItem = {
            id: uid(),
            name: uniqueName(file.name, siblingNames([...get().items, ...created], parentId)),
            kind: 'file',
            parentId,
            mime: file.type || 'application/octet-stream',
            size: file.size,
            createdAt: time,
            updatedAt: time,
          };
          await blobStore.put(blobKey(item.id), file);
          created.push(item);
        }
        set(s => ({ items: [...s.items, ...created] }));
        return created;
      },

      rename(id, name) {
        const clean = name.trim();
        if (!clean) return;
        set(s => {
          const item = s.items.find(i => i.id === id);
          if (!item) return s;
          const finalName = uniqueName(clean, siblingNames(s.items, item.parentId, id));
          return { items: s.items.map(i => (i.id === id ? { ...i, name: finalName, updatedAt: nowIso() } : i)) };
        });
      },

      remove(ids) {
        const all = withDescendants(get().items, ids);
        const doomed = new Set(all);
        for (const id of all) {
          const it = get().items.find(i => i.id === id);
          if (it?.kind === 'file') void blobStore.delete(blobKey(id));
        }
        set(s => ({
          items: s.items.filter(i => !doomed.has(i.id)),
          clipboard: s.clipboard ? { ...s.clipboard, ids: s.clipboard.ids.filter(i => !doomed.has(i)) } : null,
        }));
      },

      move(ids, targetId) {
        const items = get().items;
        // Forbid moving a folder into itself or one of its children.
        const forbidden = new Set(withDescendants(items, ids));
        if (targetId && forbidden.has(targetId)) return 0;
        let moved = 0;
        const next = [...items];
        for (const id of ids) {
          const idx = next.findIndex(i => i.id === id);
          if (idx < 0 || next[idx].parentId === targetId) continue;
          next[idx] = {
            ...next[idx],
            parentId: targetId,
            name: uniqueName(next[idx].name, siblingNames(next, targetId, id)),
            updatedAt: nowIso(),
          };
          moved++;
        }
        set({ items: next });
        return moved;
      },

      async duplicate(ids) {
        const items = get().items;
        const groups = new Map<string | null, string[]>();
        for (const id of ids) {
          const it = items.find(i => i.id === id);
          if (!it) continue;
          groups.set(it.parentId, [...(groups.get(it.parentId) ?? []), id]);
        }
        let all: DriveItem[] = [];
        for (const [parent, group] of groups) {
          const { created, blobCopies } = cloneTree([...items, ...all], group, parent, false);
          await Promise.all(blobCopies.map(([a, b]) => blobStore.copy(blobKey(a), blobKey(b))));
          all = [...all, ...created];
        }
        set(s => ({ items: [...s.items, ...all] }));
      },

      copy: ids => set({ clipboard: { mode: 'copy', ids } }),
      cut: ids => set({ clipboard: { mode: 'cut', ids } }),

      async paste(targetId) {
        const clip = get().clipboard;
        if (!clip || clip.ids.length === 0) return;
        if (clip.mode === 'cut') {
          get().move(clip.ids, targetId);
          set({ clipboard: null });
          return;
        }
        const { created, blobCopies } = cloneTree(get().items, clip.ids, targetId, true);
        await Promise.all(blobCopies.map(([a, b]) => blobStore.copy(blobKey(a), blobKey(b))));
        set(s => ({ items: [...s.items, ...created] }));
      },

      toggleStar: id => set(s => ({ items: s.items.map(i => (i.id === id ? { ...i, starred: !i.starred } : i)) })),
    }),
    { name: 'drive', storage: userStorage, skipHydration: true, partialize: s => ({ items: s.items }) },
  ),
);

export async function getFileUrl(id: string): Promise<string | null> {
  const blob = await blobStore.get(blobKey(id));
  return blob ? URL.createObjectURL(blob) : null;
}

export type FileCategory = 'folder' | 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'doc' | 'sheet' | 'slides' | 'archive' | 'other';

export function categoryOf(item: Pick<DriveItem, 'kind' | 'mime' | 'name'>): FileCategory {
  if (item.kind === 'folder') return 'folder';
  const mime = item.mime ?? '';
  const ext = item.name.split('.').pop()?.toLowerCase() ?? '';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (['doc', 'docx', 'odt', 'rtf', 'pages'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'ods', 'csv', 'numbers'].includes(ext)) return 'sheet';
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return 'slides';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (mime.startsWith('text/') || ['md', 'txt', 'json', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css'].includes(ext)) return 'text';
  return 'other';
}
