// AI mode: the conversation goes through our server (/api/copilot, see server/copilot.mjs),
// which holds the API key, Copilot's personality and picks the AI provider (Claude, Gemini,
// Groq…). The server always answers in the Anthropic message shape, so this file doesn't
// care which provider is behind. Tools run here, on the student's data.

import type Anthropic from '@anthropic-ai/sdk';
import { fmt, todayKey } from '../lib/dates';
import { useCopilot, type CopilotLink } from '../store/copilot';
import type { EventCategory } from '../store/calendar';
import { useNotes } from '../store/notes';
import { getSettings } from '../store/settings';
import { accessToken } from '../lib/supabase';
import {
  search, analyzeCalendar, eventsBetween, addEvent, createNote, createDriveFolder, listDriveFolder, readNote, overview,
  linkToNote, linkToDriveFolder, linkToDay, describeEvent, findExam, planRevisions, appendToNote, updateEvent, goTo,
  deleteEvent, findItem, linkToItem, itemName, renameItem, moveItem, setStar, setFolderColor, trashItems, listTrash, restoreFromTrash,
  searchNotes, listTodos, addTodo, completeTodo, deleteTodo, startFocus, stopFocus, updateSettings,
} from './actions';
import { readFileText } from './fileText';
import type { BotReply } from './localBrain';

type Block = Anthropic.Beta.BetaContentBlock;
type Param = Anthropic.Beta.BetaMessageParam;

export class CopilotApiError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/** Personality and preferences, sent with every request (the server builds the prompt). */
function persona() {
  const { persona, personaNotes } = getSettings();
  return { persona, personaNotes: personaNotes.slice(0, 600) };
}

async function post<T>(path: string, body: unknown, timeoutMs = 90_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const token = await accessToken();
    const res = await fetch(`/api/copilot/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new CopilotApiError(data.error ?? `http_${res.status}`);
    return data as T;
  } catch (e) {
    if (e instanceof CopilotApiError) throw e;
    throw new CopilotApiError((e as Error).name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(t);
  }
}

export interface AiStatus {
  enabled: boolean;
  provider?: string;
  label?: string;
  model?: string;
}

let lastStatus: AiStatus = { enabled: false };
/** The provider found by the last status check (shown discreetly in the UI). */
export const aiStatus = () => lastStatus;

export async function checkAiStatus(): Promise<AiStatus> {
  try {
    const res = await fetch('/api/copilot/status');
    const data = res.ok ? await res.json() : {};
    lastStatus = { enabled: Boolean(data.enabled), provider: data.provider, label: data.label, model: data.model };
  } catch {
    lastStatus = { enabled: false };
  }
  return lastStatus;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []);

async function runTool(name: string, input: Record<string, unknown>, links: CopilotLink[]): Promise<unknown> {
  if ('_invalid_arguments' in input) throw new Error('arguments illisibles (JSON invalide), réessaie avec des arguments JSON valides');
  switch (name) {
    case 'search_site': {
      const hits = search(str(input.query), 10);
      links.push(...hits.slice(0, 3).map(h => ({ label: h.title, to: h.to })));
      return hits.map(({ to: _to, ...h }) => h);
    }
    case 'search_notes': {
      const hits = searchNotes(str(input.query));
      links.push(...hits.slice(0, 3).map(h => ({ label: h.title, to: linkToNote(h.id) })));
      return hits.length ? hits : { result: 'aucune note ne contient ce texte' };
    }
    case 'get_overview':
      return overview();
    case 'read_note':
      return readNote(str(input.note_id)) ?? { error: 'note introuvable' };
    case 'read_file': {
      const res = await readFileText(str(input.file_id));
      const s = findItem(str(input.file_id));
      if (!('error' in res) && s) links.push({ label: `Ouvrir « ${itemName(s)} »`, to: linkToItem(s) });
      return res;
    }
    case 'list_drive_folder': {
      const res = listDriveFolder(str(input.folder) || undefined);
      if (res) links.push({ label: res.folder, to: res.link });
      return res ?? { error: 'dossier introuvable' };
    }
    case 'analyze_calendar': {
      const a = analyzeCalendar();
      links.push({ label: 'Calendrier', to: '/calendrier' });
      const ev = (list: typeof a.today) => list.map(e => ({ id: e.id, desc: describeEvent(e) }));
      return { ...a, today: ev(a.today), exams: ev(a.exams), lateHomework: ev(a.lateHomework), nextDeadlines: ev(a.nextDeadlines) };
    }
    case 'list_events':
      return eventsBetween(str(input.from), str(input.to)).map(e => ({ id: e.id, title: e.title, date: e.date, start: e.start, end: e.end, category: e.category, done: e.done }));
    case 'add_event': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str(input.date)) || !str(input.title)) throw new Error('title et date (YYYY-MM-DD) requis');
      const ev = addEvent({
        title: str(input.title),
        date: str(input.date),
        start: str(input.start) || undefined,
        end: str(input.end) || undefined,
        category: (str(input.category) as EventCategory) || undefined,
      });
      links.push({ label: 'Voir le jour', to: linkToDay(ev.date) });
      return { created: describeEvent(ev), id: ev.id };
    }
    case 'update_event': {
      const ev = updateEvent(str(input.event_id), {
        title: str(input.title) || undefined,
        date: str(input.date) || undefined,
        start: str(input.start) || undefined,
        end: str(input.end) || undefined,
        done: typeof input.done === 'boolean' ? input.done : undefined,
      });
      if (!ev) throw new Error('événement introuvable');
      links.push({ label: 'Voir le jour', to: linkToDay(ev.date) });
      return { updated: describeEvent(ev) };
    }
    case 'delete_event': {
      const ev = deleteEvent(str(input.event_id));
      if (!ev) throw new Error('événement introuvable');
      return { deleted: describeEvent(ev) };
    }
    case 'plan_revisions': {
      const exam = findExam(str(input.exam));
      if (!exam) throw new Error('examen introuvable');
      const res = planRevisions(exam.id, typeof input.sessions === 'number' ? input.sessions : 3)!;
      links.push({ label: 'Voir le planning', to: linkToDay(res.created[0].date) });
      if (res.note) links.push({ label: 'Ouvrir la fiche', to: linkToNote(res.note.id) });
      return { exam: describeEvent(exam), sessions: res.created.map(describeEvent), note: res.note?.title };
    }
    case 'create_note': {
      const n = createNote(str(input.title) || 'Note', typeof input.content === 'string' ? input.content : '', str(input.folder) || undefined);
      links.push({ label: `Ouvrir « ${n.title} »`, to: linkToNote(n.id) });
      return { created: n.title, id: n.id };
    }
    case 'append_to_note': {
      const n = appendToNote(str(input.note_id), typeof input.content === 'string' ? input.content : '');
      if (!n) throw new Error('note introuvable');
      links.push({ label: `Ouvrir « ${n.title} »`, to: linkToNote(n.id) });
      return { updated: n.title };
    }
    case 'create_folder': {
      if (input.space === 'notes') {
        const f = useNotes.getState().createFolder(str(input.name), null);
        links.push({ label: f.name, to: `/notes?dossier=${f.id}` });
        return { created: f.name, id: f.id };
      }
      const f = createDriveFolder(str(input.name), str(input.parent) || undefined);
      links.push({ label: f.name, to: linkToDriveFolder(f.id) });
      return { created: f.name, id: f.id };
    }
    case 'rename_item': {
      const s = renameItem(str(input.id), str(input.new_name));
      if (!s) throw new Error('élément introuvable ou nom vide');
      links.push({ label: itemName(s), to: linkToItem(s) });
      return { renamed: itemName(s) };
    }
    case 'move_item': {
      const res = moveItem(str(input.id), str(input.folder) || undefined);
      if ('error' in res) throw new Error(res.error);
      links.push({ label: itemName(res.moved), to: linkToItem(res.moved) });
      return { moved: itemName(res.moved), to: res.to };
    }
    case 'star_file': {
      const it = setStar(str(input.id), input.starred !== false);
      if (!it) throw new Error('fichier ou dossier du Drive introuvable');
      return { item: it.name, starred: input.starred !== false };
    }
    case 'set_folder_color': {
      const f = setFolderColor(str(input.folder), str(input.color));
      if (!f) throw new Error('dossier du Drive ou couleur introuvable');
      links.push({ label: f.name, to: linkToDriveFolder(f.id) });
      return { folder: f.name, color: str(input.color) };
    }
    case 'trash_items': {
      const res = trashItems(ids(input.ids));
      if (!res.done.length) throw new Error('aucun élément trouvé avec ces id');
      return { moved_to_trash: res.done, not_found: res.missing, note: 'récupérable 30 jours depuis la corbeille' };
    }
    case 'list_trash': {
      const list = listTrash();
      return list.length ? list : { result: 'la corbeille est vide' };
    }
    case 'restore_from_trash': {
      const res = restoreFromTrash(ids(input.ids));
      if (!res.restored.length) throw new Error('rien trouvé dans la corbeille avec ces id');
      return res;
    }
    case 'list_todos': {
      const list = listTodos(input.include_done === true);
      return list.length ? list : { result: 'aucune tâche' };
    }
    case 'add_todo': {
      if (!str(input.title)) throw new Error('title requis');
      const t = addTodo(str(input.title), str(input.due) || undefined);
      return { created: t.title, id: t.id, due: t.due };
    }
    case 'complete_todo': {
      const t = completeTodo(str(input.todo_id), input.done !== false);
      if (!t) throw new Error('tâche introuvable');
      return { todo: t.title, done: input.done !== false };
    }
    case 'delete_todo': {
      const t = deleteTodo(str(input.todo_id));
      if (!t) throw new Error('tâche introuvable');
      return { deleted: t.title };
    }
    case 'start_focus':
      return { started: startFocus(str(input.subject)) };
    case 'stop_focus':
      return stopFocus() ?? { result: 'aucune session en cours' };
    case 'update_settings': {
      const changed = updateSettings({
        accent: str(input.accent) || undefined,
        theme: str(input.theme) || undefined,
        reduceMotion: typeof input.reduce_motion === 'boolean' ? input.reduce_motion : undefined,
        chattiness: str(input.chattiness) || undefined,
      });
      if (!changed) throw new Error('aucun réglage valide fourni');
      links.push({ label: 'Réglages', to: '/profil' });
      return { changed };
    }
    case 'open_page':
      goTo(str(input.path) || '/');
      return { opened: str(input.path) };
    default:
      throw new Error(`outil inconnu : ${name}`);
  }
}

let history: Param[] = [];
export const resetClaudeHistory = () => {
  history = [];
};

const PAGES: Record<string, string> = { '/': 'Accueil', '/drive': 'Drive', '/calendrier': 'Calendrier', '/taches': 'Tâches', '/notes': 'Notes', '/groupes': 'Groupes', '/profil': 'Profil et réglages' };

/** Facts from the app that the AI can't see otherwise, prepended to each user turn. */
function contextBlock(): string {
  const now = new Date();
  const msgs = useCopilot.getState().messages;
  const lastUser = msgs.map(m => m.role).lastIndexOf('user', msgs.length - 2);
  const recentProactive = msgs.slice(lastUser + 1, -1).filter(m => m.role === 'bot' && m.proactive).map(m => `« ${m.text} »`);
  const lines = [
    `Date : ${fmt(now, "EEEE d MMMM yyyy 'à' HH:mm")} (${todayKey()})`,
    `Page ouverte : ${PAGES[location.pathname] ?? location.pathname}`,
  ];
  const { school, program, year } = getSettings();
  const profile = [year, program, school].filter(Boolean).join(', ');
  if (profile) lines.push(`Profil de l'étudiant : ${profile}`);
  if (recentProactive.length) lines.push(`Tu lui as dit récemment, de toi-même : ${recentProactive.join(' ')}`);
  if (history.length === 0) {
    const earlier = msgs.slice(-9, -1).filter(m => !m.proactive);
    if (earlier.length) lines.push(`Fin de votre conversation précédente : ${earlier.map(m => `${m.role === 'user' ? 'Lui' : 'Toi'}: ${m.text}`).join(' | ').slice(0, 1500)}`);
  }
  return `[Contexte]\n${lines.join('\n')}`;
}

export async function claudeReply(text: string, userName: string): Promise<BotReply> {
  const links: CopilotLink[] = [];
  const before = history.length;
  history.push({ role: 'user', content: [{ type: 'text', text: contextBlock() }, { type: 'text', text }] });
  try {
    for (let step = 0; step < 10; step++) {
      const res = await post<{ content: Block[]; stop_reason: string }>('chat', { messages: history, userName, ...persona() });
      history.push({ role: 'assistant', content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
      if (res.stop_reason === 'refusal') return { text: "Là je préfère ne pas m'aventurer. On parle d'autre chose ?" };
      if (res.stop_reason === 'pause_turn') continue;

      const toolUses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (toolUses.length === 0) {
        const answer = res.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n')
          .trim();
        const unique = links.filter((l, i) => links.findIndex(x => x.to === l.to) === i).slice(0, 4);
        return { text: answer || "C'est fait.", links: unique };
      }
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        try {
          const out = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, links);
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) });
        } catch (e) {
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: (e as Error).message, is_error: true });
        }
      }
      history.push({ role: 'user', content: results });
    }
    return { text: "J'ai fait plusieurs choses, jette un œil.", links };
  } catch (e) {
    history = history.slice(0, before); // keep the conversation valid for the next try
    throw e;
  }
}

export type NudgeKind = 'remark' | 'brief' | 'review';
const NUDGE_MAX: Record<NudgeKind, number> = { remark: 320, brief: 520, review: 640 };

/** Lets the AI phrase a proactive remark in Copilot's voice. Returns null on any problem. */
export async function aiNudge(situation: Record<string, unknown>, userName: string, kind: NudgeKind = 'remark'): Promise<string | null> {
  try {
    const res = await post<{ text: string }>(
      'nudge',
      { situation: { ...situation, maintenant: fmt(new Date(), "EEEE d MMMM 'à' HH:mm") }, userName, kind, ...persona() },
      kind === 'remark' ? 9000 : 15000,
    );
    const t = res.text?.trim();
    return t && t.length <= NUDGE_MAX[kind] ? t : null;
  } catch {
    return null;
  }
}

export function describeApiError(e: unknown): string {
  const code = e instanceof CopilotApiError ? e.code : 'unknown';
  if (code === 'rate_limited') return 'Doucement, je reprends mon souffle deux secondes. Réessaie juste après.';
  if (code === 'network' || code === 'timeout') return "J'ai perdu la connexion une seconde.";
  if (code === 'bad_key') return "Ma clé d'accès à l'IA ne marche pas (à vérifier dans la configuration du serveur).";
  return "J'ai un petit souci technique de mon côté.";
}
