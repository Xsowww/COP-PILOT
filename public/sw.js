// Kompaly's service worker: only for notifications (no offline cache, every request goes to the network).
// Registered by src/lib/push.ts. A push comes from server/push.mjs: { title, body, url, tag, user }.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Chrome, Edge…: a push may be shown inside an open page instead of as a system notification.
// Safari (Mac, iPhone) and Firefox count a push without a notification against the site: there, always one.
const inPageAllowed = /Chrome\//.test(self.navigator.userAgent) && !/iPhone|iPad|iPod/.test(self.navigator.userAgent);

/** Asks the open pages to show it themselves; true when one of them did (visible, same account). */
function shownInPage(windows, data) {
  if (!windows.length) return Promise.resolve(false);
  return new Promise(resolve => {
    let left = windows.length;
    const done = ok => {
      if (ok) resolve(true);
      else if (--left === 0) resolve(false);
    };
    for (const w of windows) {
      const ch = new MessageChannel();
      ch.port1.onmessage = e => done(e.data === 'shown');
      w.postMessage({ type: 'kompaly-reminder', reminder: data, mayShow: inPageAllowed }, [ch.port2]);
      setTimeout(() => done(false), 1500);
    }
  });
}

/** Same look as the app's own notifications (src/lib/notify.ts): keep the two in step. */
function notificationOptions(data) {
  return {
    body: data.body || '',
    tag: data.tag || undefined, // the same reminder from the page and from the server: shown once
    lang: 'fr',
    icon: '/icon-192.png', // the Kompaly logo
    badge: '/notification-badge.png', // Android status bar: one colour, the logo's two circles
    data: { url: data.url || '/' },
    timestamp: Date.now(),
    // Computers and Android (Chrome, Edge): two buttons under the notification; elsewhere a tap opens it.
    actions: [
      { action: 'voir', title: 'Voir' },
      { action: 'ok', title: 'OK' },
    ],
  };
}

self.addEventListener('push', e => {
  let data;
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { body: e.data ? e.data.text() : '' };
  }
  const title = data.title || 'Kompaly';
  e.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if ((await shownInPage(windows, data)) && inPageAllowed) return;
      await self.registration.showNotification(title, notificationOptions(data));
    })(),
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'ok') return; // « OK » : seen, nothing to open
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const tab = windows.find(w => new URL(w.url).origin === self.location.origin);
      if (tab) {
        // The app goes to the page itself (no reload): src/lib/reminderScheduler.ts.
        tab.postMessage({ type: 'kompaly-open', url });
        await tab.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
