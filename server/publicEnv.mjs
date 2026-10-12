// Loads .env.supabase.public (public Supabase URL + publishable key, safe to commit)
// without overriding values already defined in the environment or in .env.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function loadPublicEnv() {
  if (process.env.COP_LOCAL) return; // COP_LOCAL=1 npm run dev → local mode (tests, no real accounts)
  let text = '';
  try {
    text = readFileSync(fileURLToPath(new URL('../.env.supabase.public', import.meta.url)), 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
