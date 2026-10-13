// Cloud mode: keeps Supabase in sync with the app's stores.
// The stores stay the source of truth for the UI (instant, works offline for a moment);
// every change is diffed and pushed in small batches, and retried if the network fails.

import { supabase } from './supabase';
import { useCalendar, type CalendarEvent } from '../store/calendar';
import { useNotes, type Note, type NoteFolder } from '../store/notes';
import { useDrive, type DriveItem } from '../store/drive';
import { useSettings, DEFAULT_SETTINGS, type Settings } from '../store/settings';
import { useUi } from '../store/ui';
import { useTodos, type Todo } from '../store/todos';
import { useFocusLog, type FocusSession } from '../store/focusLog';

type Row = Record<string, unknown>;
type Table = 'events' | 'note_folders' | 'notes' | 'drive_items' | 'todos' | 'focus_sessions';

// ── Row mapping (app shape ⇄ database columns) ─────────────────────────────

const eventToRow = (e: CalendarEvent): Row => ({
  id: e.id,
  title: e.title,
  date: e.date,
  start_time: e.start ?? null,
  end_time: e.end ?? null,
  category: e.category,
  done: e.done,
  details: e.details ?? null,
  external_id: e.externalId ?? null,
  created_at: e.createdAt,
  deleted_at: e.deletedAt ?? null,
});
const rowToEvent = (r: Row): CalendarEvent => ({
  id: r.id as string,
  title: r.title as string,
  date: r.date as string,
  start: (r.start_time as string) ?? undefined,
  end: (r.end_time as string) ?? undefined,
  category: r.category as CalendarEvent['category'],
  done: r.done as boolean,
  details: (r.details as string) ?? undefined,
  externalId: (r.external_id as string) ?? undefined,
  createdAt: r.created_at as string,
  deletedAt: (r.deleted_at as string) ?? undefined,
});

const folderToRow = (f: NoteFolder): Row => ({ id: f.id, name: f.name, parent_id: f.parentId, created_at: f.createdAt, deleted_at: f.deletedAt ?? null });
const rowToFolder = (r: Row): NoteFolder => ({
  id: r.id as string,
  name: r.name as string,
  parentId: (r.parent_id as string) ?? null,
  createdAt: r.created_at as string,
  deletedAt: (r.deleted_at as string) ?? undefined,
});

const noteToRow = (n: Note): Row => ({
  id: n.id,
  title: n.title,
  content: n.content,
  folder_id: n.folderId,
  pinned: !!n.pinned,
  links: n.links ?? [],
  created_at: n.createdAt,
  updated_at: n.updatedAt,
  deleted_at: n.deletedAt ?? null,
});
const rowToNote = (r: Row): Note => ({
  id: r.id as string,
  title: r.title as string,
  content: r.content as string,
  folderId: (r.folder_id as string) ?? null,
  pinned: r.pinned as boolean,
  links: Array.isArray(r.links) && r.links.length ? (r.links as Note['links']) : undefined,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
  deletedAt: (r.deleted_at as string) ?? undefined,
});

const itemToRow = (i: DriveItem): Row => ({
  id: i.id,
  name: i.name,
  kind: i.kind,
  parent_id: i.parentId,
  mime: i.mime ?? null,
  size: i.size ?? null,
  starred: !!i.starred,
  color: i.color ?? null,
  tags: i.tags ?? [],
  created_at: i.createdAt,
  updated_at: i.updatedAt,
  deleted_at: i.deletedAt ?? null,
});
const rowToItem = (r: Row): DriveItem => ({
  id: r.id as string,
  name: r.name as string,
  kind: r.kind as DriveItem['kind'],
  parentId: (r.parent_id as string) ?? null,
  mime: (r.mime as string) ?? undefined,
  size: r.size == null ? undefined : Number(r.size),
  starred: r.starred as boolean,
  color: (r.color as string) ?? undefined,
  tags: Array.isArray(r.tags) && r.tags.length ? (r.tags as string[]) : undefined,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
  deletedAt: (r.deleted_at as string) ?? undefined,
});

const todoToRow = (t: Todo): Row => ({ id: t.id, title: t.title, done: t.done, due: t.due ?? null, created_at: t.createdAt, done_at: t.doneAt ?? null });
const rowToTodo = (r: Row): Todo => ({
  id: r.id as string,
  title: r.title as string,
  done: r.done as boolean,
  due: (r.due as string) ?? undefined,
  createdAt: r.created_at as string,
  doneAt: (r.done_at as string) ?? undefined,
});

const focusToRow = (f: FocusSession): Row => ({ id: f.id, subject: f.subject, minutes: f.minutes, started_at: f.startedAt });
const rowToFocus = (r: Row): FocusSession => ({ id: r.id as string, subject: (r.subject as string) ?? '', minutes: Number(r.minutes), startedAt: r.started_at as string });

const isTrashed = (r: Row) => r.deleted_at != null;

// ── Pending changes ─────────────────────────────────────────────────────────

// Parents must exist before their children: folders first, Drive items by depth.
const ORDER: Table[] = ['note_folders', 'notes', 'drive_items', 'events', 'todos', 'focus_sessions'];
const pending = Object.fromEntries(ORDER.map(t => [t, { upserts: new Map<string, Row>(), deletes: new Set<string>() }])) as Record<
  Table,
  { upserts: Map<string, Row>; deletes: Set<string> }
>;
let profileDirty = false;
let pulling = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;
let warned = false;
let unsubscribers: (() => void)[] = [];
let currentUser: string | null = null;

const hasPending = () => profileDirty || ORDER.some(t => pending[t].upserts.size || pending[t].deletes.size);

// The queue is mirrored in localStorage, so a change made just before closing the tab
// is sent on the next visit instead of being overwritten by the older cloud copy.
const queueKey = (userId: string) => `cop:${userId}:sync-queue`;

function saveQueue() {
  if (!currentUser) return;
  try {
    if (!hasPending()) {
      localStorage.removeItem(queueKey(currentUser));
      return;
    }
    const data = Object.fromEntries(ORDER.map(t => [t, { upserts: [...pending[t].upserts.values()], deletes: [...pending[t].deletes] }]));
    localStorage.setItem(queueKey(currentUser), JSON.stringify({ tables: data, profileDirty }));
  } catch {
    /* storage full or unavailable: the in-memory queue still works */
  }
}

function loadQueue(userId: string) {
  try {
    const raw = localStorage.getItem(queueKey(userId));
    if (!raw) return;
    const saved = JSON.parse(raw) as { tables: Record<Table, { upserts: Row[]; deletes: string[] }>; profileDirty: boolean };
    for (const t of ORDER) {
      for (const r of saved.tables[t]?.upserts ?? []) pending[t].upserts.set(r.id as string, r);
      for (const id of saved.tables[t]?.deletes ?? []) pending[t].deletes.add(id);
    }
    profileDirty ||= saved.profileDirty;
  } catch {
    /* corrupted queue: ignore */
  }
}

function schedule(delay = 700) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), delay);
}

function depthOf(items: DriveItem[], id: string) {
  let d = 0;
  let cur = items.find(i => i.id === id);
  while (cur?.parentId && d < 50) {
    const parent = cur.parentId;
    cur = items.find(i => i.id === parent);
    d++;
  }
  return d;
}

function folderDepth(folders: NoteFolder[], id: string) {
  let d = 0;
  let cur = folders.find(f => f.id === id);
  while (cur?.parentId && d < 50) {
    const parent = cur.parentId;
    cur = folders.find(f => f.id === parent);
    d++;
  }
  return d;
}

async function flush() {
  if (!supabase || !currentUser || flushing) return;
  flushing = true;
  try {
    // Never send this account's changes with another account's session (switched in another tab).
    const { data: s } = await supabase.auth.getSession();
    if (s.session?.user.id !== currentUser) {
      flushing = false;
      if (s.session) location.reload();
      return;
    }
    for (const table of ORDER) {
      const p = pending[table];
      if (p.upserts.size) {
        let rows = [...p.upserts.values()];
        if (table === 'drive_items') {
          const items = [...useDrive.getState().items, ...useDrive.getState().trash];
          rows = rows.sort((a, b) => depthOf(items, a.id as string) - depthOf(items, b.id as string));
        }
        if (table === 'note_folders') {
          const folders = [...useNotes.getState().folders, ...useNotes.getState().trashFolders];
          rows = rows.sort((a, b) => folderDepth(folders, a.id as string) - folderDepth(folders, b.id as string));
        }
        const { error } = await supabase.from(table).upsert(rows);
        if (error) throw error;
        for (const r of rows) if (p.upserts.get(r.id as string) === r) p.upserts.delete(r.id as string);
      }
      if (p.deletes.size) {
        const ids = [...p.deletes];
        const { error } = await supabase.from(table).delete().in('id', ids);
        if (error) throw error;
        ids.forEach(id => p.deletes.delete(id));
      }
    }
    if (profileDirty) {
      profileDirty = false;
      const { set: _set, reset: _reset, ...settings } = useSettings.getState();
      const { error } = await supabase.from('profiles').update({ settings }).eq('id', currentUser);
      if (error) {
        profileDirty = true;
        throw error;
      }
    }
    warned = false;
    saveQueue();
  } catch (e) {
    console.error('[sync]', e);
    if (!warned) {
      warned = true;
      useUi.getState().toast('Synchronisation impossible pour le moment, nouvel essai automatique…', 'error');
    }
    schedule(8000);
  } finally {
    flushing = false;
    if (hasPending() && !warned) schedule();
  }
}

/** Records the difference between two versions of a list (immutable updates → reference check). */
function diff<T extends { id: string }>(table: Table, cur: T[], prev: T[], toRow: (x: T) => Row) {
  if (pulling || cur === prev) return;
  const before = new Map(prev.map(x => [x.id, x]));
  const now = new Set<string>();
  for (const x of cur) {
    now.add(x.id);
    if (before.get(x.id) !== x) {
      pending[table].upserts.set(x.id, toRow(x));
      pending[table].deletes.delete(x.id);
    }
  }
  for (const id of before.keys()) {
    if (!now.has(id)) {
      pending[table].upserts.delete(id);
      pending[table].deletes.add(id);
    }
  }
  saveQueue();
  schedule();
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface CloudProfile {
  name: string;
  onboarded: boolean;
}

/** Sends changes left over from a previous visit (tab closed before they were sent). */
export async function pushLeftovers(userId: string) {
  currentUser = userId;
  loadQueue(userId);
  if (hasPending()) await flush();
  if (hasPending()) throw new Error('leftover changes could not be sent');
}

/** Downloads everything for the signed-in user and replaces the stores' content. */
export async function pullAll(userId: string): Promise<CloudProfile> {
  if (!supabase) throw new Error('cloud disabled');
  const [events, folders, notes, items, profile, todos, focus] = await Promise.all([
    supabase.from('events').select('*'),
    supabase.from('note_folders').select('*'),
    supabase.from('notes').select('*'),
    supabase.from('drive_items').select('*'),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(), // '*': tolerate older schemas
    supabase.from('todos').select('*'),
    supabase.from('focus_sessions').select('*'),
  ]);
  const err = events.error ?? folders.error ?? notes.error ?? items.error ?? profile.error;
  if (err) throw err;

  pulling = true;
  try {
    const f = folders.data ?? [];
    const n = notes.data ?? [];
    const i = items.data ?? [];
    const ev = events.data ?? [];
    useCalendar.setState({ events: ev.filter(r => !isTrashed(r)).map(rowToEvent), trash: ev.filter(isTrashed).map(rowToEvent) });
    useNotes.setState({
      folders: f.filter(r => !isTrashed(r)).map(rowToFolder),
      notes: n.filter(r => !isTrashed(r)).map(rowToNote),
      trashFolders: f.filter(isTrashed).map(rowToFolder),
      trashNotes: n.filter(isTrashed).map(rowToNote),
    });
    useDrive.setState({ items: i.filter(r => !isTrashed(r)).map(rowToItem), trash: i.filter(isTrashed).map(rowToItem), clipboard: null });
    // Tables added later: an older database without them keeps the local copy.
    if (!todos.error) useTodos.setState({ todos: (todos.data ?? []).map(rowToTodo) });
    if (!focus.error) useFocusLog.setState({ sessions: (focus.data ?? []).map(rowToFocus) });
    const saved = (profile.data?.settings ?? {}) as Partial<Settings>;
    const known = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
    useSettings.setState(Object.fromEntries(known.filter(k => k in saved).map(k => [k, saved[k]])) as Partial<Settings>);
  } finally {
    pulling = false;
  }
  // Databases created before the "onboarded" column existed: onboarded as soon as there is any data.
  const hasData = !!(events.data?.length || notes.data?.length || items.data?.length || folders.data?.length);
  const onboarded = typeof profile.data?.onboarded === 'boolean' ? profile.data.onboarded || hasData : hasData;
  return { name: profile.data?.name ?? '', onboarded };
}

/** Starts pushing every change of the stores to Supabase. */
export function startSync(userId: string) {
  stopSync();
  currentUser = userId;
  unsubscribers = [
    useCalendar.subscribe((s, p) => {
      if (s.events !== p.events || s.trash !== p.trash) diff('events', [...s.events, ...s.trash], [...p.events, ...p.trash], eventToRow);
    }),
    useNotes.subscribe((s, p) => {
      if (s.folders !== p.folders || s.trashFolders !== p.trashFolders)
        diff('note_folders', [...s.folders, ...s.trashFolders], [...p.folders, ...p.trashFolders], folderToRow);
      if (s.notes !== p.notes || s.trashNotes !== p.trashNotes) diff('notes', [...s.notes, ...s.trashNotes], [...p.notes, ...p.trashNotes], noteToRow);
    }),
    useDrive.subscribe((s, p) => {
      if (s.items !== p.items || s.trash !== p.trash) diff('drive_items', [...s.items, ...s.trash], [...p.items, ...p.trash], itemToRow);
    }),
    useTodos.subscribe((s, p) => diff('todos', s.todos, p.todos, todoToRow)),
    useFocusLog.subscribe((s, p) => diff('focus_sessions', s.sessions, p.sessions, focusToRow)),
    useSettings.subscribe(() => {
      if (pulling) return;
      profileDirty = true;
      saveQueue();
      schedule(1200);
    }),
  ];
  const onLeave = () => {
    if (hasPending()) void flush();
  };
  window.addEventListener('pagehide', onLeave);
  // Coming back to the tab: fetch changes made on another device.
  const onVisible = () => {
    if (document.visibilityState === 'visible' && !hasPending() && currentUser) void pullAll(currentUser).catch(() => undefined);
  };
  document.addEventListener('visibilitychange', onVisible);
  unsubscribers.push(
    () => window.removeEventListener('pagehide', onLeave),
    () => document.removeEventListener('visibilitychange', onVisible),
  );
}

export function stopSync() {
  unsubscribers.forEach(u => u());
  unsubscribers = [];
  saveQueue(); // keep unsent changes for the next visit
  currentUser = null;
  clearTimeout(flushTimer);
  for (const t of ORDER) {
    pending[t].upserts.clear();
    pending[t].deletes.clear();
  }
  profileDirty = false;
}

/** Sends what's still waiting (before signing out, for instance). */
/** Sends what is waiting; true when nothing is left to send. */
export async function flushNow() {
  clearTimeout(flushTimer);
  if (hasPending()) await flush();
  return !hasPending();
}

export async function updateCloudProfile(userId: string, patch: { name?: string; onboarded?: boolean }) {
  if (!supabase) return;
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  // Older schema without the "onboarded" column: keep the name update at least.
  if (error && 'onboarded' in patch && patch.name) await supabase.from('profiles').update({ name: patch.name }).eq('id', userId);
}
