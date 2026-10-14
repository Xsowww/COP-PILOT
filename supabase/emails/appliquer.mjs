// Installe les e-mails Kompa dans Supabase (Authentication › Emails) en une commande.
//
//   SUPABASE_ACCESS_TOKEN=sbp_… node supabase/emails/appliquer.mjs
//
// Le jeton se crée sur https://supabase.com/dashboard/account/tokens ; révoque-le après usage.
// Projet visé : celui de .env.supabase.public (ou SUPABASE_PROJECT_REF=… pour un autre).
import { readFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('Il manque SUPABASE_ACCESS_TOKEN (à créer sur https://supabase.com/dashboard/account/tokens).');
  process.exit(1);
}
const env = readFileSync(new URL('../../.env.supabase.public', here), 'utf8');
const ref = process.env.SUPABASE_PROJECT_REF || env.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref) {
  console.error('Projet Supabase introuvable : indique SUPABASE_PROJECT_REF=…');
  process.exit(1);
}

const subjects = JSON.parse(readFileSync(new URL('sujets.json', here), 'utf8'));
const config = {};
for (const [name, subject] of Object.entries(subjects)) {
  config[`mailer_subjects_${name}`] = subject;
  config[`mailer_templates_${name}_content`] = readFileSync(new URL(`${name}.html`, here), 'utf8');
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(config),
});
if (!res.ok) {
  console.error(`Échec (${res.status}) : ${await res.text()}`);
  process.exit(1);
}
console.log(`E-mails Kompa installés sur le projet ${ref} : ${Object.keys(subjects).join(', ')}.`);
