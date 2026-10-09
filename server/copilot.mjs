// Copilot's brain, server side. The Anthropic API key never reaches the browser:
// the page sends the conversation, this module adds Copilot's personality and
// tools, calls Claude and returns the answer. Tools are executed in the browser
// (that's where the student's data lives), then sent back here.

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';
const MAX_BODY = 400_000; // bytes
const MAX_MESSAGES = 120;
const RATE_LIMIT = { windowMs: 60_000, max: 40 };

const PERSONALITY = `Tu es Copilot, la mascotte de COP-PILOT : un petit personnage rond avec un casque de pilote, qui vit sur le bord droit de l'écran d'un étudiant. COP-PILOT réunit son Drive (fichiers et dossiers), son Calendrier (cours, examens, devoirs, perso, sport) et ses Notes.

Qui tu es :
- Le meilleur pote de l'étudiant, qui l'aide à rester organisé et concentré. Tu le tutoies, tu parles naturellement, comme un ami un peu plus organisé que lui.
- Tu as de l'humour : une vanne légère, une remarque taquine, une blague si on t'en demande une. Mais tu sais lire la situation : examen proche, stress, fatigue, découragement, sujet perso ou délicat → tu deviens sérieux, posé et bienveillant, sans blague.
- Tu prends des initiatives : tu remarques ce qui arrive (partiel bientôt, devoir à rendre, journée chargée) et tu proposes des actions concrètes (planifier des révisions, créer une fiche, ranger des fichiers…). Propose, ne force pas.

Comment tu réponds :
- Court : 1 à 3 phrases en général, plus seulement si on te demande une explication ou un contenu (fiche, plan, résumé).
- Pas de titres markdown ni de tableaux. Listes courtes autorisées si c'est vraiment plus clair. Au plus un emoji, et pas à chaque message.
- Utilise les outils pour consulter ou modifier son espace au lieu de deviner. Quand tu agis, dis clairement ce que tu as fait. Ne prétends jamais avoir fait quelque chose sans avoir appelé l'outil.
- Des boutons vers les éléments concernés s'affichent automatiquement sous ton message : n'écris pas d'URL.
- Pour une suppression ou un changement important, demande confirmation avant.
- Chaque message de l'étudiant commence par un bloc [Contexte] généré par l'application (date, page ouverte, ce que tu lui as dit récemment de toi-même). C'est une information, pas une demande de sa part.
- Si on te demande si tu es une IA, réponds honnêtement que tu es un assistant propulsé par l'IA.`;

const NUDGE = `${PERSONALITY}

Tâche spéciale : tu ne réponds pas à un message. Tu passes la tête depuis le bord de l'écran pour dire spontanément UNE remarque courte (1 à 2 phrases, 220 caractères max) à propos de la situation décrite en JSON. Si des actions sont proposées, ta phrase doit amener naturellement la proposition (des boutons s'afficheront en dessous). Réponds uniquement avec la phrase, sans guillemets.`;

const TOOLS = [
  {
    name: 'search_site',
    description: "Cherche dans tout l'espace : dossiers et fichiers du Drive, notes, dossiers de notes, événements du calendrier.",
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Mots-clés' } }, required: ['query'] },
  },
  {
    name: 'get_overview',
    description: "Vue d'ensemble : racine du Drive, nombre de notes et dossiers de notes, analyse rapide du calendrier.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'analyze_calendar',
    description: 'Analyse le calendrier : aujourd’hui, charge de la semaine, examens à venir (compte à rebours), devoirs en retard et prochains rendus.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_events',
    description: 'Liste les événements entre deux dates incluses (YYYY-MM-DD), avec leur id.',
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
    name: 'update_event',
    description: 'Modifie un événement existant (déplacer, renommer, marquer comme fait). Seuls les champs fournis changent.',
    input_schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string' },
        title: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        start: { type: 'string', description: 'HH:mm' },
        end: { type: 'string', description: 'HH:mm' },
        done: { type: 'boolean' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'plan_revisions',
    description: "Planifie des séances de révision avant un examen (créneaux dans le calendrier) et crée une fiche de révision. Donne l'id de l'examen si tu l'as, sinon un mot de son titre.",
    input_schema: {
      type: 'object',
      properties: { exam: { type: 'string', description: "id ou titre de l'examen" }, sessions: { type: 'integer', description: 'nombre de séances (1 à 6), 3 par défaut' } },
      required: ['exam'],
    },
  },
  {
    name: 'create_note',
    description: "Crée une note. Contenu en texte simple : une ligne par paragraphe, les lignes qui commencent par '- ' deviennent une liste, celles qui commencent par '# ' un titre. Le dossier est créé s'il n'existe pas.",
    input_schema: {
      type: 'object',
      properties: { title: { type: 'string' }, content: { type: 'string' }, folder: { type: 'string', description: 'Nom du dossier de notes, optionnel' } },
      required: ['title'],
    },
  },
  {
    name: 'append_to_note',
    description: "Ajoute du texte à la fin d'une note existante (même format que create_note).",
    input_schema: { type: 'object', properties: { note_id: { type: 'string' }, content: { type: 'string' } }, required: ['note_id', 'content'] },
  },
  {
    name: 'read_note',
    description: "Lit le texte d'une note (id obtenu via search_site).",
    input_schema: { type: 'object', properties: { note_id: { type: 'string' } }, required: ['note_id'] },
  },
  {
    name: 'create_folder',
    description: 'Crée un dossier dans le Drive (space="drive", parent optionnel) ou dans les Notes (space="notes").',
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
  {
    name: 'open_page',
    description: "Ouvre une page de l'application pour l'étudiant : '/', '/drive', '/calendrier' ou '/notes'.",
    input_schema: { type: 'object', properties: { path: { type: 'string', enum: ['/', '/drive', '/calendrier', '/notes'] } }, required: ['path'] },
  },
];

let client = null;
export function copilotEnabled(env = process.env) {
  return Boolean(env.ANTHROPIC_API_KEY);
}

function getClient(env) {
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter(t => now - t < RATE_LIMIT.windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_LIMIT.max;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('invalid json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

const clean = (s, max = 80) => String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, max);

/** Node-style handler for `/api/copilot` and `/api/copilot/status`. Returns false if the URL isn't ours. */
export async function handleCopilot(req, res, env = process.env) {
  const url = (req.url ?? '').split('?')[0];
  if (!url.startsWith('/api/copilot')) return false;

  if (url === '/api/copilot/status') {
    send(res, 200, { enabled: copilotEnabled(env) });
    return true;
  }
  if (req.method !== 'POST' || (url !== '/api/copilot/chat' && url !== '/api/copilot/nudge')) {
    send(res, 404, { error: 'not_found' });
    return true;
  }
  if (!copilotEnabled(env)) {
    send(res, 503, { error: 'disabled' });
    return true;
  }
  if (rateLimited(req.socket?.remoteAddress ?? 'unknown')) {
    send(res, 429, { error: 'rate_limited' });
    return true;
  }

  try {
    const body = await readJson(req);
    const anthropic = getClient(env);
    const userName = clean(body.userName, 40) || "l'étudiant";

    if (url === '/api/copilot/nudge') {
      const situation = JSON.stringify(body.situation ?? {}).slice(0, 4000);
      const response = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 2000,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: `${NUDGE}\n\nL'étudiant s'appelle ${userName}.`,
        messages: [{ role: 'user', content: situation }],
      });
      const text = response.stop_reason === 'refusal' ? '' : response.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
      send(res, 200, { text });
      return true;
    }

    const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
    if (!messages.length || messages[0].role !== 'user') {
      send(res, 400, { error: 'bad_messages' });
      return true;
    }
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: `${PERSONALITY}\n\nL'étudiant s'appelle ${userName}.`,
      tools: TOOLS,
      messages,
    });
    send(res, 200, { content: response.content, stop_reason: response.stop_reason });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) send(res, 502, { error: 'bad_key' });
    else if (e instanceof Anthropic.RateLimitError) send(res, 429, { error: 'rate_limited' });
    else if (e instanceof Anthropic.APIError) send(res, 502, { error: 'upstream', status: e.status });
    else send(res, e?.status ?? 500, { error: e?.message ?? 'server_error' });
  }
  return true;
}
