// Production server: serves the built app (dist/) and Copilot's API.
// Usage: npm run build && npm start   (reads the AI settings — AI_PROVIDER, AI_API_KEY… — from the environment or .env)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleCopilot, copilotProvider } from './copilot.mjs';
import { loadPublicEnv } from './publicEnv.mjs';

try {
  process.loadEnvFile();
} catch {
  /* no .env file: rely on the real environment */
}
loadPublicEnv();

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript', // pdf.js worker: refused by browsers under any other type
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// ── Security headers (every answer) ─────────────────────────────────────────
const SUPABASE = (() => {
  try {
    return new URL(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).origin;
  } catch {
    return '';
  }
})();
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'", // pdf.js decodes some images with WebAssembly
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  `connect-src 'self' blob: data:${SUPABASE ? ` ${SUPABASE} ${SUPABASE.replace(/^https:/, 'wss:')}` : ''}`,
  "worker-src 'self' blob:",
  "frame-src 'self' blob:", // file previews
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
const SECURITY = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)', // microphone: dictation to Copilot
  'Strict-Transport-Security': 'max-age=31536000',
};

// ── Static files ────────────────────────────────────────────────────────────
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.svg', '.json', '.txt', '.webmanifest']);
/** Built files never change while the server runs: read and compressed once. */
const files = new Map();

async function serveStatic(req, res) {
  let path;
  try {
    path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  } catch {
    res.statusCode = 400;
    return res.end('Adresse invalide');
  }
  path = normalize(path).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, path);
  if (!(await stat(file).then(s => s.isFile(), () => false))) {
    // A missing code file must get a 404, not the page: a tab opened before an update asks for
    // old files, and only a real error lets it reload itself (see main.tsx).
    if (path.startsWith('/assets/') || extname(path)) {
      res.statusCode = 404;
      return res.end('Introuvable');
    }
    file = join(DIST, 'index.html'); // single-page app: every route is the page
  }
  let entry = files.get(file);
  if (!entry) {
    const raw = await readFile(file);
    entry = { raw, gzip: COMPRESSIBLE.has(extname(file)) && raw.length > 1024 ? gzipSync(raw) : null };
    files.set(file, entry);
  }
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
  // Hashed file names change with each build; the page itself must always be checked again.
  res.setHeader('Cache-Control', file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
  const gzip = entry.gzip && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
  if (entry.gzip) res.setHeader('Vary', 'Accept-Encoding');
  if (gzip) res.setHeader('Content-Encoding', 'gzip');
  res.end(gzip ? entry.gzip : entry.raw);
}

const server = createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY)) res.setHeader(k, v);
  try {
    if (await handleCopilot(req, res)) return;
    await serveStatic(req, res);
  } catch (e) {
    console.error('[serveur]', req.method, req.url, e);
    if (!res.headersSent) res.statusCode = 500;
    res.end('Erreur serveur');
  }
}).listen(PORT, () => {
  const ai = copilotProvider();
  console.log(`COP-PILOT sur http://localhost:${PORT} — Copilot IA ${ai ? `activé (${ai.label}, ${ai.model})` : 'désactivé (voir AI_PROVIDER / AI_API_KEY dans .env.example)'}`);
});

process.on('unhandledRejection', e => console.error('[serveur] promesse non gérée', e));
// The host stops the server to deploy a new version: finish the requests in progress first.
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
});
