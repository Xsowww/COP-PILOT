// AI mode: the conversation goes through our server (/api/copilot, see server/copilot.mjs),
// which holds the API key and Copilot's personality. Tools run here, on the student's data.

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
} from './actions';
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

async function post<T>(path: string, body: unknown, timeoutMs = 60_000): Promise<T> {
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

export async function checkAiStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/copilot/status');
    return res.ok && Boolean((await res.json()).enabled);
  } catch {
    return false;
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function runTool(name: string, input: Record<string, unknown>, links: CopilotLink[]): unknown {
  switch (name) {
    case 'search_site': {
      const hits = search(str(input.query), 10);
      links.push(...hits.slice(0, 3).map(h => ({ label: h.title, to: h.to })));
      return hits.map(({ to: _to, ...h }) => h);
    }
    case 'get_overview':
      return overview();
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
    case 'plan_revisions': {
      const exam = findExam(str(input.exam));
      if (!exam) throw new Error('examen introuvable');
      const res = planRevisions(exam.id, typeof input.sessions === 'number' ? input.sessions : 3)!;
      links.push({ label: 'Voir le planning', to: linkToDay(res.created[0].date) });
      if (res.note) links.push({ label: 'Ouvrir la fiche', to: linkToNote(res.note.id) });
      return { exam: describeEvent(exam), sessions: res.created.map(describeEvent), note: res.note?.title };
    }
    case 'create_note': {
      const n = createNote(str(input.title) || 'Note', str(input.content), str(input.folder) || undefined);
      links.push({ label: `Ouvrir « ${n.title} »`, to: linkToNote(n.id) });
      return { created: n.title, id: n.id };
    }
    case 'append_to_note': {
      const n = appendToNote(str(input.note_id), str(input.content));
      if (!n) throw new Error('note introuvable');
      links.push({ label: `Ouvrir « ${n.title} »`, to: linkToNote(n.id) });
      return { updated: n.title };
    }
    case 'read_note':
      return readNote(str(input.note_id)) ?? { error: 'note introuvable' };
    case 'create_folder': {
      if (input.space === 'notes') {
        const f = useNotes.getState().createFolder(str(input.name), null);
        links.push({ label: f.name, to: `/notes?dossier=${f.id}` });
        return { created: f.name };
      }
      const f = createDriveFolder(str(input.name), str(input.parent) || undefined);
      links.push({ label: f.name, to: linkToDriveFolder(f.id) });
      return { created: f.name };
    }
    case 'list_drive_folder': {
      const res = listDriveFolder(str(input.folder) || undefined);
      if (res) links.push({ label: res.folder, to: res.link });
      return res ?? { error: 'dossier introuvable' };
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

const PAGES: Record<string, string> = { '/': 'Accueil', '/drive': 'Drive', '/calendrier': 'Calendrier', '/notes': 'Notes', '/profil': 'Profil et réglages' };

/** Facts from the app that Claude can't see otherwise, prepended to each user turn. */
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
      const res = await post<{ content: Block[]; stop_reason: string }>('chat', { messages: history, userName });
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
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map(tu => {
        try {
          return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, links)) };
        } catch (e) {
          return { type: 'tool_result', tool_use_id: tu.id, content: (e as Error).message, is_error: true };
        }
      });
      history.push({ role: 'user', content: results });
    }
    return { text: "J'ai fait plusieurs choses, jette un œil.", links };
  } catch (e) {
    history = history.slice(0, before); // keep the conversation valid for the next try
    throw e;
  }
}

/** Lets Claude phrase a proactive remark in Copilot's voice. Returns null on any problem. */
export async function aiNudge(situation: Record<string, unknown>, userName: string): Promise<string | null> {
  try {
    const res = await post<{ text: string }>('nudge', { situation: { ...situation, maintenant: fmt(new Date(), "EEEE d MMMM 'à' HH:mm") }, userName }, 9000);
    const t = res.text?.trim();
    return t && t.length <= 320 ? t : null;
  } catch {
    return null;
  }
}

export function describeApiError(e: unknown): string {
  const code = e instanceof CopilotApiError ? e.code : 'unknown';
  if (code === 'rate_limited') return 'Doucement, je reprends mon souffle deux secondes. Réessaie juste après.';
  if (code === 'network' || code === 'timeout') return "J'ai perdu la connexion une seconde.";
  return "J'ai un petit souci technique de mon côté.";
}

