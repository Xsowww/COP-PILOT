// Contrôle de santé du site en ligne, lancé chaque matin par GitHub Actions (.github/workflows/surveillance.yml)
// et à la main : node scripts/surveillance.mjs [https://kompaly.com]
// Un contrôle raté fait échouer le job : GitHub prévient par e-mail.

import { connect } from 'node:tls';

const SITE = (process.argv[2] || process.env.SITE_URL || 'https://kompaly.com').replace(/\/$/, '');
const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ ok: true, name, detail });
  } catch (e) {
    results.push({ ok: false, name, detail: e instanceof Error ? e.message : String(e) });
  }
}

async function get(path, init) {
  const r = await fetch(SITE + path, { redirect: 'manual', signal: AbortSignal.timeout(20_000), ...init });
  return r;
}

const must = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// 1. Server and database (the server asks Supabase).
await check('Serveur et base de données (/api/sante)', async () => {
  const r = await get('/api/sante');
  const body = await r.json().catch(() => ({}));
  must(r.status === 200 && body.ok === true, `réponse ${r.status} ${JSON.stringify(body)}`);
  must(body.ia === 'configurée', 'l’IA de Kompaly n’est pas configurée (AI_PROVIDER / AI_API_KEY sur Render)');
  // « désactivés » is allowed (push not set up yet); « erreur »: the server can't read the reminders (key, migration…).
  must(!String(body.rappels ?? '').startsWith('erreur'), 'l’envoi des rappels échoue (voir les journaux Render : SUPABASE_SERVICE_ROLE_KEY, migration 2026-10-17)');
  return `base ${body.base}, rappels ${body.rappels ?? '?'}${body.version ? `, version ${body.version}` : ''}`;
});

// 2. The app itself: the page, then its main script.
await check('Application (page d’accueil et script)', async () => {
  const r = await get('/');
  must(r.status === 200, `page d’accueil : ${r.status}`);
  const html = await r.text();
  const js = html.match(/\/assets\/index-[\w-]+\.js/)?.[0];
  must(js, 'script principal introuvable dans la page');
  const s = await get(js);
  must(s.status === 200, `script ${js} : ${s.status}`);
  return js;
});

// 3. Public pages (sign-in, legal pages, SEO files).
for (const path of ['/connexion', '/inscription', '/mentions-legales', '/confidentialite', '/conditions', '/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/og-image.png']) {
  await check(`Page ${path}`, async () => {
    const r = await get(path);
    must(r.status === 200, `réponse ${r.status}`);
    return '200';
  });
}

// 4. Security headers (CSP with the anti-robot check, HTTPS forced).
await check('En-têtes de sécurité', async () => {
  const r = await get('/');
  const csp = r.headers.get('content-security-policy') ?? '';
  must(csp.includes("frame-ancestors 'none'"), 'CSP absente ou incomplète');
  must(csp.includes('challenges.cloudflare.com'), 'la CSP ne laisse pas passer Cloudflare Turnstile (captcha)');
  must((r.headers.get('strict-transport-security') ?? '').includes('max-age'), 'HSTS absent');
  return 'CSP, HSTS';
});

// 5. HTTPS certificate: warn well before it expires.
await check('Certificat HTTPS', () => {
  const host = new URL(SITE).hostname;
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port: 443, servername: host, timeout: 15_000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      const days = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000);
      if (days < 14) reject(new Error(`expire dans ${days} jours (${cert.valid_to})`));
      else resolve(`valable encore ${days} jours`);
    });
    socket.on('error', reject);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('pas de réponse'));
    });
  });
});

// 6. The former address still sends people to the new one.
await check('Ancienne adresse kompa-app.com → kompaly.com', async () => {
  const r = await fetch('https://kompa-app.com/connexion', { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
  const to = r.headers.get('location') ?? '';
  must(r.status === 301 && to.startsWith('https://kompaly.com'), `réponse ${r.status} ${to}`);
  return to;
});

const failed = results.filter(r => !r.ok);
const lines = results.map(r => `${r.ok ? '✅' : '❌'} ${r.name} — ${r.detail}`);
console.log(`Surveillance de ${SITE} — ${new Date().toISOString()}\n`);
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Surveillance de ${SITE}\n\n${failed.length ? `**${failed.length} contrôle(s) en échec**` : 'Tout va bien.'}\n\n${lines.map(l => `- ${l}`).join('\n')}\n`);
}
console.log(failed.length ? `\n${failed.length} contrôle(s) en échec.` : '\nTout va bien.');
process.exit(failed.length ? 1 : 0);
