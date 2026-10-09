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
  return `${e.title} (${c.label.toLowerCase()}) — ${fmt(fromKey(e.date), 'EEEE d MMM')}${time}${e.done ? ' · fait' : ''}`;
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
      : "Rien de prévu aujourd'hui, profites-en.",
  );
  lines.push(`Cette semaine : ${a.weekCount} événement${a.weekCount > 1 ? 's' : ''}, ${a.weekDone} déjà fait${a.weekDone > 1 ? 's' : ''}.`);
  if (a.busiestDay && a.busiestDay.count > 1) {
    lines.push(`Ta journée la plus chargée : ${fmt(fromKey(a.busiestDay.date), 'EEEE')} (${a.busiestDay.count} trucs).`);
  }
  if (a.exams.length) {
    lines.push(`Examens à venir : ${a.exams.map(e => `${e.title} (${countdownLabel(e.date)})`).join(', ')}.`);
    const soon = a.exams.find(e => daysUntil(e.date) <= 7);
    if (soon) lines.push(`Conseil : commence à réviser « ${soon.title} » dès maintenant, un peu chaque jour.`);
  }
  if (a.lateHomework.length) lines.push(`Attention, ${a.lateHomework.length} devoir(s) en retard : ${a.lateHomework.map(e => e.title).join(', ')}.`);
  else if (a.nextDeadlines.length) lines.push(`Prochain rendu : ${a.nextDeadlines[0].title} (${countdownLabel(a.nextDeadlines[0].date)}).`);
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
  return useNotes.getState().createNote({ title, content: textToHtml(content), folderId });
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

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Plain text → note HTML: "# " = heading, "- " = bullet, "[ ] " = checkbox, other lines = paragraphs. */
export function textToHtml(text: string): string {
  const out: string[] = [];
  let list: 'ul' | 'task' | null = null;
  const close = () => {
    if (list) out.push('</ul>');
    list = null;
  };
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line) {
      close();
      continue;
    }
    const task = line.match(/^[-*]?\s*\[( |x)\]\s+(.*)$/i);
    if (task) {
      if (list !== 'task') {
        close();
        out.push('<ul data-type="taskList">');
        list = 'task';
      }
      out.push(`<li data-type="taskItem" data-checked="${task[1].toLowerCase() === 'x'}"><p>${esc(task[2])}</p></li>`);
    } else if (/^[-*•]\s+/.test(line)) {
      if (list !== 'ul') {
        close();
        out.push('<ul>');
        list = 'ul';
      }
      out.push(`<li><p>${esc(line.replace(/^[-*•]\s+/, ''))}</p></li>`);
    } else if (/^#{1,3}\s+/.test(line)) {
      close();
      out.push(`<h2>${esc(line.replace(/^#{1,3}\s+/, ''))}</h2>`);
    } else {
      close();
      out.push(`<p>${esc(line)}</p>`);
    }
  }
  close();
  return out.join('');
}

export function appendToNote(id: string, text: string) {
  const n = useNotes.getState().notes.find(x => x.id === id);
  if (!n) return null;
  useNotes.getState().updateNote(id, { content: n.content + textToHtml(text) });
  return n;
}

export function findExam(query: string) {
  const events = useCalendar.getState().events.filter(e => e.category === 'examen');
  const byId = events.find(e => e.id === query);
  if (byId) return byId;
  const q = normalize(query);
  const upcoming = events.filter(e => e.date >= todayKey()).sort(sortEvents);
  return upcoming.find(e => normalize(e.title).includes(q)) ?? (q ? undefined : upcoming[0]);
}

const revisionTitle = (examTitle: string) => `Révision · ${examTitle}`;

export function hasRevisionPlan(examTitle: string) {
  return useCalendar.getState().events.some(e => e.title === revisionTitle(examTitle));
}

/** Creates (or reuses) a revision sheet for an exam, in the "Révisions" notes folder. */
export function createRevisionNote(examId: string) {
  const exam = useCalendar.getState().events.find(e => e.id === examId);
  if (!exam) return null;
  const title = `Fiche · ${exam.title}`;
  const existing = useNotes.getState().notes.find(n => n.title === title);
  if (existing) return existing;
  return createNote(
    title,
    `# Ce qui tombe\n- Chapitres à revoir :\n- Type d'épreuve :\n# À retenir\n- \n# Mes points faibles\n[ ] \n# Questions à poser au prof\n- `,
    'Révisions',
  );
}

/** Spreads revision sessions over the days before an exam, at 18:00, skipping days already taken. */
export function planRevisions(examId: string, sessions = 3) {
  const exam = useCalendar.getState().events.find(e => e.id === examId);
  if (!exam) return null;
  const n = Math.min(6, Math.max(1, Math.round(sessions)));
  const until = daysUntil(exam.date);
  const today = new Date();
  const candidates: string[] = [];
  // Prefer J-1, J-3, J-5… then fill remaining days, never in the past.
  const order = [1, 3, 5, 2, 4, 6, 7, 9, 11, 13];
  for (const d of order) {
    if (d < until || (d === until && until === 0)) {
      const key = toKey(addDays(fromKey(exam.date), -d));
      if (key >= toKey(today)) candidates.push(key);
    }
  }
  if (candidates.length === 0) candidates.push(todayKey());
  const chosen = [...new Set(candidates)].slice(0, n).sort();
  const nowHm = fmt(today, 'HH:mm');
  const created = chosen.map(date =>
    useCalendar.getState().add({
      title: revisionTitle(exam.title),
      date,
      start: date === todayKey() && nowHm > '18:00' ? undefined : '18:00',
      end: date === todayKey() && nowHm > '18:00' ? undefined : '19:30',
      category: 'devoir',
      details: `Préparation de l'examen du ${fmt(fromKey(exam.date), 'EEEE d MMMM')}.`,
    }),
  );
  const note = createRevisionNote(exam.id);
  return { exam, created, note };
}

export function updateEvent(id: string, patch: { title?: string; date?: string; start?: string; end?: string; done?: boolean }) {
  const ev = useCalendar.getState().events.find(e => e.id === id);
  if (!ev) return null;
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== ''));
  useCalendar.getState().update(id, clean);
  return useCalendar.getState().events.find(e => e.id === id)!;
}
