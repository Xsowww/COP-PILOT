// Errors seen by students, sent to our own server's log (no third-party service, nothing personal:
// the page, the message and where it happened). Only in production, at most 10 per page load.

let sent = 0;

export function reportError(error: unknown, where: string) {
  if (!import.meta.env.PROD || sent >= 10) return;
  sent++;
  const e = error instanceof Error ? error : new Error(String(error));
  const body = JSON.stringify({ where, page: location.pathname, message: e.message.slice(0, 500), stack: (e.stack ?? '').slice(0, 2000) });
  navigator.sendBeacon?.('/api/erreurs', new Blob([body], { type: 'application/json' }));
}

export function watchErrors() {
  addEventListener('error', e => reportError(e.error ?? e.message, 'page'));
  addEventListener('unhandledrejection', e => reportError(e.reason, 'promesse'));
}
