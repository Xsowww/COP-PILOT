import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = new Map<string, string>();
Object.assign(globalThis, {
  location: new URL('http://localhost/'),
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
});
const { useNotes, notesTrashRoots } = await import('../src/store/notes');

beforeEach(() => {
  useNotes.setState({ folders: [], notes: [], trashFolders: [], trashNotes: [] });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T10:00:00'));
});

/** Folder « Chimie » with notes A and B; A is deleted first, then the folder. */
function deleteNoteThenFolder() {
  const notes = useNotes.getState();
  const folder = notes.createFolder('Chimie', null);
  const a = notes.createNote({ title: 'A', content: '', folderId: folder.id });
  const b = notes.createNote({ title: 'B', content: '', folderId: folder.id });
  useNotes.getState().removeNote(a.id);
  vi.setSystemTime(new Date('2026-10-15T10:05:00'));
  useNotes.getState().removeFolder(folder.id);
  return { folder, a, b };
}

describe('notes trash', () => {
  it('shows a note deleted before its folder as its own entry', () => {
    const { folder, a } = deleteNoteThenFolder();
    const { trashFolders, trashNotes } = useNotes.getState();
    const roots = notesTrashRoots(trashFolders, trashNotes);
    expect(roots.folders.map(f => f.id)).toEqual([folder.id]);
    expect(roots.notes.map(n => n.id)).toEqual([a.id]);
  });

  it('purging the folder keeps the note deleted earlier, at the root', () => {
    const { folder, a } = deleteNoteThenFolder();
    useNotes.getState().purge([folder.id]);
    const { trashFolders, trashNotes } = useNotes.getState();
    expect(trashFolders).toEqual([]);
    expect(trashNotes.map(n => [n.id, n.folderId])).toEqual([[a.id, null]]);
  });
});
