// Copilot's brain, server side. The AI key never reaches the browser: the page sends
// the conversation, this module adds Copilot's personality and tools (copilotPrompt.mjs),
// calls the configured AI (Claude, or a free provider via aiProviders.mjs) and returns the
// answer in the Anthropic shape. Tools are executed in the browser (that's where the
// student's data lives), then sent back here.

import Anthropic from '@anthropic-ai/sdk';
import { resolveProvider, openAiChat, ProviderError } from './aiProviders.mjs';
import { chatSystem, nudgeSystem, TOOLS, NUDGE_MAX_CHARS } from './copilotPrompt.mjs';

const MAX_BODY = 1_500_000; // bytes (file contents read by Copilot travel in the history)
const MAX_MESSAGES = 120;
const RATE_LIMIT = { windowMs: 60_000, max: 40 };

let client = null;
let clientKey = '';

/** True when an AI provider is configured (see aiProviders.mjs and .env.example). */
export function copilotEnabled(env = process.env) {
  return Boolean(resolveProvider(env));
}

/** Provider name and model, for the start-up log and /status. */
export function copilotProvider(env = process.env) {
  const p = resolveProvider(env);
  return p ? { provider: p.id, label: p.label, model: p.model } : null;
}

function getClient(apiKey) {
  if (!client || clientKey !== apiKey) {
    client = new Anthropic({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

/** Server-side refusal fallback, for the models that accept the « default » form. */
const fallbackParams = model =>
  /^claude-(opus-5-5|opus-5|fable-5-1)$/.test(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {};

async function anthropicChat(p, { system, messages, tools, maxTokens }) {
  const response = await getClient(p.apiKey).beta.messages.create({
    model: p.model,
    max_tokens: maxTokens,
    output_config: { effort: 'low' },
    ...fallbackParams(p.model),
    system,
    ...(tools ? { tools } : {}),
    messages,
  });
  return { content: response.content, stop_reason: response.stop_reason };
}

/** One model call, whatever the provider. Answer in the Anthropic shape: { content, stop_reason }. */
function chat(p, req) {
  return p.id === 'anthropic' ? anthropicChat(p, req) : openAiChat(p, req);
}

// ── Who is calling? (cloud mode only) ───────────────────────────────────────
// With Supabase configured, only signed-in students can talk to Copilot: the page sends
// its session token and we ask Supabase who it belongs to (cached one minute).
const tokenCache = new Map();
async function authenticate(req, env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return { id: null }; // local mode: no accounts on the server
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const cached = tokenCache.get(token);
  if (cached && cached.until > Date.now()) return cached.user;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const user = { id: (await r.json()).id };
    tokenCache.set(token, { user, until: Date.now() + 60_000 });
    if (tokenCache.size > 5000) tokenCache.clear();
    return user;
  } catch {
    return null;
  }
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

/** Node-style handler for `/api/copilot` and `/api/copilot/status`. Returns false if the URL isn't ours. */
export async function handleCopilot(req, res, env = process.env) {
  const url = (req.url ?? '').split('?')[0];
  if (!url.startsWith('/api/copilot')) return false;

  if (url === '/api/copilot/status') {
    const p = resolveProvider(env);
    send(res, 200, p ? { enabled: true, provider: p.id, label: p.label, model: p.model } : { enabled: false });
    return true;
  }
  if (req.method !== 'POST' || (url !== '/api/copilot/chat' && url !== '/api/copilot/nudge')) {
    send(res, 404, { error: 'not_found' });
    return true;
  }
  const caller = await authenticate(req, env);
  if (!caller) {
    send(res, 401, { error: 'unauthorized' });
    return true;
  }
  const provider = resolveProvider(env);
  if (!provider) {
    send(res, 503, { error: 'disabled' });
    return true;
  }
  if (rateLimited(caller.id ?? req.socket?.remoteAddress ?? 'unknown')) {
    send(res, 429, { error: 'rate_limited', retryAfter: 60 });
    return true;
  }

  try {
    const body = await readJson(req);

    if (url === '/api/copilot/nudge') {
      // Free providers have a tight quota (Groq: 8 000 tokens/min): keep it for the student's own
      // requests, spontaneous remarks are then phrased by the app itself. AI_NUDGES=1 turns them back on.
      if (provider.id !== 'anthropic' && env.AI_NUDGES !== '1') {
        send(res, 200, { text: '' });
        return true;
      }
      const kind = Object.hasOwn(NUDGE_MAX_CHARS, body.kind) ? body.kind : 'remark';
      const situation = JSON.stringify(body.situation ?? {}).slice(0, 4000);
      const response = await chat(provider, {
        system: nudgeSystem({ ...body, kind }),
        messages: [{ role: 'user', content: situation }],
        maxTokens: 2000,
        timeoutMs: 20_000,
      });
      const text = response.stop_reason === 'refusal' ? '' : response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      send(res, 200, { text });
      return true;
    }

    const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
    if (!messages.length || messages[0].role !== 'user') {
      send(res, 400, { error: 'bad_messages' });
      return true;
    }
    const response = await chat(provider, { system: chatSystem(body), tools: TOOLS, messages, maxTokens: provider.id === 'anthropic' ? 16000 : 8000 });
    send(res, 200, response);
  } catch (e) {
    if (e instanceof ProviderError) send(res, e.code === 'timeout' ? 504 : e.code === 'rate_limited' ? 429 : 502, { error: e.code, status: e.status, retryAfter: e.retryAfter });
    else if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) send(res, 502, { error: 'bad_key' });
    else if (e instanceof Anthropic.RateLimitError) send(res, 429, { error: 'rate_limited' });
    else if (e instanceof Anthropic.APIConnectionTimeoutError) send(res, 504, { error: 'timeout' });
    else if (e instanceof Anthropic.APIError) send(res, 502, { error: 'upstream', status: e.status });
    else send(res, e?.status ?? 500, { error: e?.message ?? 'server_error' });
  }
  return true;
}
