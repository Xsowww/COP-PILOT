// Everything Copilot can *do* on the site. Used by both the built-in French
// command engine and the Claude-powered mode (as tools).

import { addDays } from 'date-fns';
import { useDrive, pathOf, childrenOf, categoryOf } from '../store/drive';
import { useNotes } from '../store/notes';
import { useCalendar, CATEGORIES, guessCategory, sortEvents, type EventCategory } from '../store/calendar';
import { normalize, stripHtml, formatBytes } from '../lib/utils';
import { toKey, todayKey, daysUntil, fromKey, fmt, weekStart, countdownLabel } from '../lib/dates';
import type { CopilotLink } from '../store/copilot';

let navigateFn: ((to: string) => void) | null = null;
export const registerNavigate = (fn: (to: string) => void) => {
  navigateFn = fn;
};
export const goTo = (to: string) => navigateFn?.(to);

export const linkToDriveFolder = (id: string | null) => (id ? `/drive?dossier=${id}` : '/drive');
export const linkToNote = (id: string) => `/notes?note=${id}`;
export const linkToDay = (date: string) => `/calendrier?jour=${date}`;

export interface SearchHit {
  type: 'dossier' | 'fichier' | 'note' | 'dossier de notes' | 'événement';
  id: string;
  title: string;
  where: string;
  to: string;
}

const score = (hay: string, q: string) => {
  const h = normalize(hay);
  if (h === q) return 3;
  if (h.startsWith(q)) return 2;
  if (h.includes(q)) return 1;
  // every word of the query appears somewhere
  return q.split(/\s+/).every(w => h.includes(w)) ? 0.5 : 0;
};

export function search(query: string, limit = 8): SearchHit[] {
  const q = normalize(query);
  if (!q) return [];
  const hits: (SearchHit & { s: number })[] = [];
  const { items } = useDrive.getState();
  for (const it of items) {
    const s = score(it.name, q);
    if (!s) continue;
    const where = ['Drive', ...pathOf(items, it.parentId).map(p => p.name)].join(' › ');
    hits.push({
      s: s + (it.kind === 'folder' ? 0.2 : 0),
      type: it.kind === 'folder' ? 'dossier' : 'fichier',
      id: it.id,
      title: it.name,
      where,
      to: it.kind === 'folder' ? linkToDriveFolder(it.id) : `${linkToDriveFolder(it.parentId)}${it.parentId ? '&' : '?'}fichier=${it.id}`,
    });
  }
  const { notes, folders } = useNotes.getState();
  for (const f of folders) {
    const s = score(f.name, q);
    if (s) hits.push({ s, type: 'dossier de notes', id: f.id, title: f.name, where: 'Notes', to: `/notes?dossier=${f.id}` });
  }
  for (const n of notes) {
    const s = Math.max(score(n.title, q), score(stripHtml(n.content), q) * 0.6);
    if (s) {
      const folder = folders.find(f => f.id === n.folderId);
      hits.push({ s, type: 'note', id: n.id, title: n.title, where: folder ? `Notes › ${folder.name}` : 'Notes', to: linkToNote(n.id) });
    }
  }
  for (const e of useCalendar.getState().events) {
    const s = score(e.title, q);
    if (s) hits.push({ s, type: 'événement', id: e.id, title: e.title, where: fmt(fromKey(e.date), 'EEEE d MMMM'), to: linkToDay(e.date) });
  }
  return hits.sort((a, b) => b.s - a.s).slice(0, limit).map(({ s: _s, ...h }) => h);
}

export function eventsBetween(from: string, to: string) {
  return useCalendar
    .getState()
    .events.filter(e => e.date >= from && e.date <= to)
    .sort(sortEvents);
}

export function describeEvent(e: { title: string; date: string; start?: string; end?: string; category: EventCategory; done?: boolean }) {
  const c = CATEGORIES[e.category];
  const time = e.start ? ` à ${e.start.replace(':', 'h')}${e.end ? `–${e.end.replace(':', 'h')}` : ''}` : '';
  return `${c.emoji} ${e.title} — ${fmt(fromKey(e.date), 'EEEE d MMM')}${time}${e.done ? ' ✅' : ''}`;
}

export function analyzeCalendar() {
  const today = todayKey();
  const ws = weekStart(new Date());
  const weekEnd = toKey(addDays(ws, 6));
  const week = eventsBetween(toKey(ws), weekEnd);
  const upcoming = eventsBetween(today, toKey(addDays(new Date(), 30)));
  const exams = upcoming.filter(e => e.category === 'examen');
  const late = useCalendar.getState().events.filter(e => e.category === 'devoir' && !e.done && e.date < today);
  const todayEvents = eventsBetween(today, today);

  const perDay = new Map<string, number>();
  for (const e of week) perDay.set(e.date, (perDay.get(e.date) ?? 0) + 1);
  const busiest = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
  const done = week.filter(e => e.done).length;

  return {
    today: todayEvents,
    weekCount: week.length,
    weekDone: done,
    busiestDay: busiest ? { date: busiest[0], count: busiest[1] } : null,
    exams,
    lateHomework: late,
    nextDeadlines: upcoming.filter(e => e.category === 'devoir' && !e.done).slice(0, 5),
  };
}

export function calendarReport(): { text: string; links: CopilotLink[] } {
  const a = analyzeCalendar();
  const lines: string[] = [];
  lines.push(
    a.today.length
      ? `Aujourd'hui tu as ${a.today.length} chose${a.today.length > 1 ? 's' : ''} : ${a.today.map(e => e.title).join(', ')}.`
      : "Rien de prévu aujourd'hui, profites-en 😌",
  );
  lines.push(`Cette semaine : ${a.weekCount} événement${a.weekCount > 1 ? 's' : ''}, ${a.weekDone} déjà fait${a.weekDone > 1 ? 's' : ''}.`);
  if (a.busiestDay && a.busiestDay.count > 1) {
    lines.push(`Ta journée la plus chargée : ${fmt(fromKey(a.busiestDay.date), 'EEEE')} (${a.busiestDay.count} trucs).`);
  }
  if (a.exams.length) {
    lines.push(`🎯 Examens à venir : ${a.exams.map(e => `${e.title} (${countdownLabel(e.date)})`).join(', ')}.`);
    const soon = a.exams.find(e => daysUntil(e.date) <= 7);
    if (soon) lines.push(`Conseil : commence à réviser « ${soon.title} » dès maintenant, un peu chaque jour.`);
  }
  if (a.lateHomework.length) lines.push(`⚠️ ${a.lateHomework.length} devoir(s) en retard : ${a.lateHomework.map(e => e.title).join(', ')}.`);
  else if (a.nextDeadlines.length) lines.push(`✏️ Prochain rendu : ${a.nextDeadlines[0].title} (${countdownLabel(a.nextDeadlines[0].date)}).`);
  return { text: lines.join('\n'), links: [{ label: 'Ouvrir le calendrier', to: '/calendrier' }] };
}

export function findDriveFolderByName(name: string) {
  const q = normalize(name);
  const folders = useDrive.getState().items.filter(i => i.kind === 'folder');
  return folders.find(f => normalize(f.name) === q) ?? folders.find(f => normalize(f.name).includes(q));
}

export function findNoteFolderByName(name: string) {
  const q = normalize(name);
  const { folders } = useNotes.getState();
  return folders.find(f => normalize(f.name) === q) ?? folders.find(f => normalize(f.name).includes(q));
}

export function createNote(title: string, content = '', folderName?: string) {
  let folderId: string | null = null;
  if (folderName) {
    folderId = (findNoteFolderByName(folderName) ?? useNotes.getState().createFolder(folderName, null)).id;
  }
  const html = content
    ? content
        .split(/\n+/)
        .map(l => `<p>${l.replace(/</g, '&lt;')}</p>`)
        .join('')
    : '';
  return useNotes.getState().createNote({ title, content: html, folderId });
}

export function createDriveFolder(name: string, parentName?: string) {
  const parent = parentName ? findDriveFolderByName(parentName) : undefined;
  return useDrive.getState().createFolder(name, parent?.id ?? null);
}

export function addEvent(input: { title: string; date: string; start?: string; end?: string; category?: EventCategory }) {
  return useCalendar.getState().add({
    title: input.title,
    date: input.date,
    start: input.start || undefined,
    end: input.end || undefined,
    category: input.category ?? guessCategory(input.title),
  });
}

export function overview() {
  const { items } = useDrive.getState();
  const files = items.filter(i => i.kind === 'file');
  const { notes, folders } = useNotes.getState();
  return {
    drive: {
      folders: items.filter(i => i.kind === 'folder').length,
      files: files.length,
      totalSize: formatBytes(files.reduce((s, f) => s + (f.size ?? 0), 0)),
      rootContent: childrenOf(items, null).map(i => `${i.kind === 'folder' ? '📁' : '📄'} ${i.name}`),
    },
    notes: { count: notes.length, folders: folders.map(f => f.name) },
    calendar: analyzeCalendar(),
  };
}

export function listDriveFolder(folderName?: string) {
  const { items } = useDrive.getState();
  const folder = folderName ? findDriveFolderByName(folderName) : undefined;
  if (folderName && !folder) return null;
  return {
    folder: folder?.name ?? 'Drive (racine)',
    path: folder ? ['Drive', ...pathOf(items, folder.id).map(p => p.name)].join(' › ') : 'Drive',
    link: linkToDriveFolder(folder?.id ?? null),
    content: childrenOf(items, folder?.id ?? null).map(i => ({
      name: i.name,
      type: i.kind === 'folder' ? 'dossier' : categoryOf(i),
      size: i.kind === 'file' ? formatBytes(i.size) : undefined,
    })),
  };
}

export function readNote(id: string) {
  const n = useNotes.getState().notes.find(x => x.id === id);
  return n ? { title: n.title, text: stripHtml(n.content) } : null;
}
