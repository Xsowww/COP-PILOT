// Production server: serves the built app (dist/) and Copilot's API.
// Usage: npm run build && npm start   (reads the AI settings — AI_PROVIDER, AI_API_KEY… — from the environment or .env)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
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

async function serveStatic(req, res) {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, path);
  try {
    if (!(await stat(file)).isFile()) throw new Error('dir');
  } catch {
    file = join(DIST, 'index.html'); // single-page app fallback
  }
  const data = await readFile(file);
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
  if (file.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.end(data);
}

createServer(async (req, res) => {
  try {
    if (await handleCopilot(req, res)) return;
    await serveStatic(req, res);
  } catch {
    res.statusCode = 500;
    res.end('Erreur serveur');
  }
}).listen(PORT, () => {
  const ai = copilotProvider();
  console.log(`COP-PILOT sur http://localhost:${PORT} — Copilot IA ${ai ? `activé (${ai.label}, ${ai.model})` : 'désactivé (voir AI_PROVIDER / AI_API_KEY dans .env.example)'}`);
});
