import { useDrive } from '../store/drive';
import { useNotes } from '../store/notes';
import { useCalendar, CATEGORIES, type CalendarEvent } from '../store/calendar';
import { useSettings, DEFAULT_SETTINGS, type Settings } from '../store/settings';
import { useAuth } from '../store/auth';
import { blobStore } from './blobStore';
import { blobKey, getStorageUser } from './userStorage';
import { cloudEnabled } from './supabase';
import { purgeSoleGroups } from './groups';
import { useTodos } from '../store/todos';
import { useFocusLog } from '../store/focusLog';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Everything except file contents (those stay in the Drive). */
export function exportBackup() {
  const { avatarImage: _img, ...settings } = useSettings.getState();
  const data = {
    app: 'cop-pilot',
    version: 1,
    exportedAt: new Date().toISOString(),
    user: { name: useAuth.getState().user?.name },
    settings: Object.fromEntries(Object.entries(settings).filter(([, v]) => typeof v !== 'function')),
    calendar: useCalendar.getState().events,
    todos: useTodos.getState().todos,
    notes: { folders: useNotes.getState().folders, notes: useNotes.getState().notes },
    driveFolders: useDrive.getState().items.filter(i => i.kind === 'folder'),
  };
  download(`kompa-sauvegarde-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

/** What the backup has and this account doesn't (anywhere, trash included). Nothing current is replaced. */
function missing<T extends { id: string }>(incoming: unknown, ...current: T[][]): T[] {
  const have = new Set(current.flat().map(x => x.id));
  return (Array.isArray(incoming) ? incoming : []).filter((x): x is T => typeof x?.id === 'string' && !have.has(x.id));
}

/**
 * Brings back from an exported file the notes, events, tasks and Drive folders that are no longer
 * here (deleted for good, or another device). Current items are kept as they are, so restoring an
 * old file never erases recent work. Settings are replaced.
 */
export async function importBackup(file: File): Promise<{ notes: number; events: number }> {
  const data = JSON.parse(await file.text());
  if (data?.app !== 'cop-pilot' || !Array.isArray(data.calendar) || !data.notes) throw new Error('Ce fichier n’est pas une sauvegarde Kompa.');
  const cal = useCalendar.getState();
  const events = missing(data.calendar, cal.events, cal.trash);
  useCalendar.setState(s => ({ events: [...s.events, ...events] }));
  const nb = useNotes.getState();
  const folders = missing(data.notes.folders, nb.folders, nb.trashFolders);
  const notes = missing(data.notes.notes, nb.notes, nb.trashNotes);
  useNotes.setState(s => ({ folders: [...s.folders, ...folders], notes: [...s.notes, ...notes] }));
  if (data.settings) {
    const known = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
    useSettings.getState().set(Object.fromEntries(known.filter(k => k in data.settings).map(k => [k, data.settings[k]])) as Partial<Settings>);
  }
  const drive = useDrive.getState();
  const driveFolders = missing(data.driveFolders, drive.items, drive.trash);
  if (driveFolders.length) useDrive.setState(s => ({ items: [...s.items, ...driveFolders] }));
  const todos = missing(data.todos, useTodos.getState().todos);
  if (todos.length) useTodos.setState(s => ({ todos: [...s.todos, ...todos] }));
  return { notes: notes.length, events: events.length };
}

const icsDate = (date: string, time?: string) => (time ? `${date.replace(/-/g, '')}T${time.replace(':', '')}00` : date.replace(/-/g, ''));
const icsText = (t: string) => t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => `\\${m}`);

function nextDay(date: string) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** .ics file that Google Agenda, Apple Calendrier or Outlook can import. */
export function exportIcs(events: CalendarEvent[] = useCalendar.getState().events) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kompa//FR', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@cop-pilot`, `DTSTAMP:${now}`);
    if (e.start) {
      lines.push(`DTSTART:${icsDate(e.date, e.start)}`);
      lines.push(`DTEND:${icsDate(e.date, e.end ?? e.start)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(e.date)}`, `DTEND;VALUE=DATE:${icsDate(nextDay(e.date))}`);
    }
    lines.push(`SUMMARY:${icsText(e.title)}`, `CATEGORIES:${CATEGORIES[e.category].label}`);
    if (e.details) lines.push(`DESCRIPTION:${icsText(e.details)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  download(`kompa-calendrier-${stamp()}.ics`, lines.join('\r\n'), 'text/calendar');
}

/** Removes every file, note and event of the current account (the account itself stays). */
export async function wipeUserData({ deletingAccount = false } = {}) {
  const user = getStorageUser();
  if (cloudEnabled && user) {
    // Everything stored under the account's folder, even files this device doesn't know about.
    await blobStore.removeFolder(user);
    if (deletingAccount) await purgeSoleGroups().catch(() => undefined);
  } else {
    const files = [...useDrive.getState().items, ...useDrive.getState().trash].filter(i => i.kind === 'file');
    await Promise.all(files.map(f => blobStore.delete(blobKey(f.id)).catch(() => undefined)));
  }
  useDrive.setState({ items: [], trash: [], clipboard: null });
  useNotes.setState({ notes: [], folders: [], trashNotes: [], trashFolders: [] });
  useCalendar.setState({ events: [], trash: [] });
  useTodos.setState({ todos: [] });
  useFocusLog.setState({ sessions: [] });
}

/** Resizes a picked image to a small square data URL for the avatar. */
export function imageToAvatar(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = url;
  });
}
