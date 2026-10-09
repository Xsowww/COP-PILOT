// Optional "smart" mode: Copilot talks through Claude and acts on the site with tools.
// The API key is entered by the user and stays in their browser.

import Anthropic from '@anthropic-ai/sdk';
import { todayKey, fmt } from '../lib/dates';
import type { CopilotLink } from '../store/copilot';
import type { EventCategory } from '../store/calendar';
import {
  search,
  analyzeCalendar,
  eventsBetween,
  addEvent,
  createNote,
  createDriveFolder,
  listDriveFolder,
  readNote,
  overview,
  linkToNote,
  linkToDriveFolder,
  linkToDay,
  describeEvent,
} from './actions';
import { useNotes } from '../store/notes';
import type { BotReply } from './localBrain';

const MODEL = 'claude-opus-5-5';

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: 'search_site',
    description: "Cherche dans tout l'espace de l'étudiant : dossiers et fichiers du Drive, notes, dossiers de notes, événements du calendrier.",
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Mots-clés à chercher' } }, required: ['query'] },
  },
  {
    name: 'get_overview',
    description: "Vue d'ensemble : contenu de la racine du Drive, nombre de notes, dossiers de notes, analyse rapide du calendrier.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'analyze_calendar',
    description: "Analyse le calendrier : événements du jour, charge de la semaine, examens à venir avec compte à rebours, devoirs en retard et prochains rendus.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_events',
    description: 'Liste les événements entre deux dates incluses (format YYYY-MM-DD).',
    input_schema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] },
  },
  {
    name: 'add_event',
    description: 'Ajoute un événement au calendrier.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        start: { type: 'string', description: 'HH:mm, optionnel' },
        end: { type: 'string', description: 'HH:mm, optionnel' },
        category: { type: 'string', enum: ['cours', 'examen', 'devoir', 'perso', 'sport'] },
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'create_note',
    description: "Crée une note. Le contenu est du texte simple (un paragraphe par ligne). Si un dossier est donné et n'existe pas, il est créé.",
    input_schema: {
      type: 'object',
      properties: { title: { type: 'string' }, content: { type: 'string' }, folder: { type: 'string', description: 'Nom du dossier de notes, optionnel' } },
      required: ['title'],
    },
  },
  {
    name: 'read_note',
    description: "Lit le texte d'une note à partir de son id (obtenu via search_site).",
    input_schema: { type: 'object', properties: { note_id: { type: 'string' } }, required: ['note_id'] },
  },
  {
    name: 'create_folder',
    description: 'Crée un dossier, soit dans le Drive (space="drive", parent optionnel), soit dans les Notes (space="notes").',
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string' }, space: { type: 'string', enum: ['drive', 'notes'] }, parent: { type: 'string' } },
      required: ['name', 'space'],
    },
  },
  {
    name: 'list_drive_folder',
    description: "Liste le contenu d'un dossier du Drive (par son nom). Sans nom : la racine.",
    input_schema: { type: 'object', properties: { folder: { type: 'string' } } },
  },
];

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function runTool(name: string, input: Record<string, unknown>, links: CopilotLink[]): unknown {
  switch (name) {
    case 'search_site': {
      const hits = search(str(input.query), 10);
      links.push(...hits.slice(0, 3).map(h => ({ label: h.title, to: h.to })));
      return hits;
    }
    case 'get_overview':
      return overview();
    case 'analyze_calendar': {
      const a = analyzeCalendar();
      links.push({ label: 'Calendrier', to: '/calendrier' });
      return { ...a, today: a.today.map(describeEvent), exams: a.exams.map(describeEvent), lateHomework: a.lateHomework.map(describeEvent), nextDeadlines: a.nextDeadlines.map(describeEvent) };
    }
    case 'list_events':
      return eventsBetween(str(input.from), str(input.to));
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
      return { created: describeEvent(ev) };
    }
    case 'create_note': {
      const n = createNote(str(input.title) || 'Note de Copilot', str(input.content), str(input.folder) || undefined);
      links.push({ label: `Ouvrir « ${n.title} »`, to: linkToNote(n.id) });
      return { created: n.title, id: n.id };
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
    default:
      throw new Error(`outil inconnu : ${name}`);
  }
}

let history: Anthropic.Beta.BetaMessageParam[] = [];
export const resetClaudeHistory = () => {
  history = [];
};

function systemPrompt(userName: string) {
  return `Tu es Copilot, le petit robot assistant de COP-PILOT, un hub de productivité pour étudiants (Drive, Calendrier, Notes). Tu passes la tête depuis le bord de l'écran pour aider ${userName}.
Nous sommes le ${fmt(new Date(), 'EEEE d MMMM yyyy')} (${todayKey()}).
Réponds en français, tutoie l'étudiant, sois chaleureux, drôle avec modération et surtout bref : 1 à 4 phrases, pas de titres markdown, pas de tableaux.
Utilise les outils pour consulter ou modifier son espace plutôt que de deviner. Quand tu crées quelque chose, dis-le clairement. Des boutons de lien vers les éléments concernés s'affichent automatiquement sous ton message, inutile d'écrire des URL.
Aide l'étudiant à rester concentré : propose des actions concrètes (planifier une révision, créer une fiche, etc.).`;
}

export async function claudeReply(text: string, apiKey: string, userName: string): Promise<BotReply> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const links: CopilotLink[] = [];
  const before = history.length;
  history.push({ role: 'user', content: text });
  try {
    return await runLoop(client, links, userName);
  } catch (e) {
    history = history.slice(0, before); // keep the conversation valid for the next try
    throw e;
  }
}

async function runLoop(client: Anthropic, links: CopilotLink[], userName: string): Promise<BotReply> {
  for (let step = 0; step < 8; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: systemPrompt(userName),
      tools,
      messages: history,
    });
    history.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'refusal') {
      return { text: "Désolé, je ne peux pas t'aider sur ce point-là. Demande-moi autre chose 🙂" };
    }
    if (response.stop_reason === 'pause_turn') continue;

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (toolUses.length === 0) {
      const answer = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
      const unique = links.filter((l, i) => links.findIndex(x => x.to === l.to) === i).slice(0, 4);
      return { text: answer || 'C\'est fait ✅', links: unique };
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map(tu => {
      try {
        const out = runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, links);
        return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) };
      } catch (e) {
        return { type: 'tool_result', tool_use_id: tu.id, content: String((e as Error).message), is_error: true };
      }
    });
    history.push({ role: 'user', content: results });
  }
  return { text: "J'ai fait plusieurs actions, jette un œil 👀", links };
}

export function describeClaudeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'Ta clé API Claude est refusée 🔑 Vérifie-la dans mes réglages (⚙️).';
  if (e instanceof Anthropic.RateLimitError) return 'Trop de demandes d\'un coup, réessaie dans quelques secondes ⏳';
  if (e instanceof Anthropic.APIConnectionError) return "Je n'arrive pas à joindre Claude (connexion). Je repasse en mode local pour cette fois.";
  if (e instanceof Anthropic.APIError) return `Erreur de l'API Claude (${e.status}). Je repasse en mode local pour cette fois.`;
  return "Oups, quelque chose s'est mal passé 😵";
}
