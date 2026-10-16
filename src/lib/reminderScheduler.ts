// Reminders of events and tasks, while the app is open and when it is closed.
//
// - Online: the upcoming reminders are sent to the server (RPC replace_my_reminders), which sends them as
//   push notifications at the right time (server/push.mjs → public/sw.js), even with the site closed.
// - In the app: the next day's reminders are also timed here. Page in view: a card in the app (ReminderAlerts);
//   page in the background: a system notification. When the server's push reaches this device, it shows first
//   and the app's own timer, a little later, sees it is done.
// Every reminder has a key (lib/reminders): shown once, whichever way it came.

import { eventReminders, upcomingReminders, type DueReminder, type ReminderSource } from './reminders';
import { useCalendar } from '../store/calendar';
import { useTodos } from '../store/todos';
import { useSettings, getSettings } from '../store/settings';
import { useUi } from '../store/ui';
import { supabase } from './supabase';
import { chime, canNotify, showSystemNotification } from './notify';
import { pushActive, refreshDevice } from './push';
import { goTo } from '../copilot/actions';

/** Push on this device: the server's notification comes first; the app shows it only if it didn't come. */
const FALLBACK_DELAY = 45_000;
/** Timers for the next day; planned again every hour, at every change and when the page comes back. */
const LOCAL_HORIZON = 26 * 3_600_000;
/** Later than that (computer asleep…), a reminder is no longer useful. */
const TOO_LATE = 30 * 60_000;

let userId: string | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];
let push = false;
let lastSent = '';
let serverReady = true;

// ── Already shown (shared by the tabs, per account) ─────────────────────────
const shownKey = () => `cop:${userId}:reminders-shown`;
function readShown(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(shownKey()) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
const wasShown = (key: string) => readShown().includes(key);
function markShown(key: string) {
  try {
    localStorage.setItem(shownKey(), JSON.stringify([...readShown().filter(k => k !== key), key].slice(-300)));
  } catch {
    /* private mode: a second tab may show it again */
  }
}

// ── What to remind ──────────────────────────────────────────────────────────
function sources(): ReminderSource[] {
  const defaults = getSettings().defaultReminders;
  return [
    ...useCalendar.getState().events.map(e => ({
      kind: 'event' as const,
      id: e.id,
      title: e.title,
      date: e.date,
      time: e.start,
      done: e.done,
      // Events made before reminders existed: the usual reminder, if they have a time.
      reminders: eventReminders(e, defaults),
    })),
    ...useTodos.getState().todos.map(t => ({ kind: 'task' as const, id: t.id, title: t.title, date: t.due, time: t.time, done: t.done, reminders: t.reminders })),
  ];
}

// ── Showing one ─────────────────────────────────────────────────────────────
function showInApp(r: { key: string; title: string; body: string; url: string }) {
  useUi.getState().showAlert({ key: r.key, title: r.title, body: r.body, url: r.url, at: Date.now() });
  if (getSettings().focusSound) chime();
}

function fire(r: DueReminder) {
  if (wasShown(r.key) || Date.now() - r.fireAt.getTime() > TOO_LATE) return;
  markShown(r.key);
  if (document.visibilityState === 'visible' || !canNotify()) showInApp(r);
  else void showSystemNotification(r.title, r.body, r.key, r.url).then(ok => ok || showInApp(r));
}

// ── Planning ────────────────────────────────────────────────────────────────
async function sendToServer(list: DueReminder[]) {
  if (!supabase || !serverReady) return;
  const items = list.slice(0, 300).map(r => ({ key: r.key, fire_at: r.fireAt.toISOString(), title: r.title, body: r.body, url: r.url }));
  const payload = JSON.stringify(items);
  if (payload === lastSent) return;
  const { error } = await supabase.rpc('replace_my_reminders', { p_items: items });
  if (!error) lastSent = payload;
  // Server without the 2026-10-17 migration: reminders only in the app, nothing more to send.
  else if (error.code === 'PGRST202' || error.message.includes('replace_my_reminders')) serverReady = false;
}

function plan() {
  timers.forEach(clearTimeout);
  timers = [];
  if (!userId) return;
  const now = Date.now();
  const list = upcomingReminders(sources(), new Date(now));
  void sendToServer(list).catch(() => undefined); // offline: sent again at the next change or hour
  for (const r of list) {
    const wait = r.fireAt.getTime() - now + (push ? FALLBACK_DELAY : 0);
    if (wait > LOCAL_HORIZON) break;
    if (!wasShown(r.key)) timers.push(setTimeout(() => fire(r), Math.max(0, wait)));
  }
}

let planTimer: ReturnType<typeof setTimeout> | undefined;
const planSoon = () => {
  clearTimeout(planTimer);
  planTimer = setTimeout(plan, 1500);
};

// ── Messages from the service worker (public/sw.js) ─────────────────────────
interface PushedReminder {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  user?: string;
  test?: boolean;
}
function onWorkerMessage(e: MessageEvent) {
  const d = e.data as { type?: string; url?: string; reminder?: PushedReminder; mayShow?: boolean } | null;
  if (d?.type === 'kompaly-open' && d.url) {
    goTo(d.url);
    return;
  }
  if (d?.type !== 'kompaly-reminder' || !d.reminder) return;
  const r = d.reminder;
  const reply = (v: 'shown' | 'no') => e.ports[0]?.postMessage(v);
  if (!userId || (r.user && r.user !== userId)) return reply('no'); // another account's reminder: the system shows it
  const key = r.tag || `push:${Date.now()}`;
  const seen = !r.test && wasShown(key);
  if (!r.test) markShown(key);
  if (d.mayShow && document.visibilityState === 'visible') {
    if (!seen) showInApp({ key, title: r.title || 'Kompaly', body: r.body || '', url: r.url || '/' });
    return reply('shown');
  }
  reply('no');
}

/** Starts the reminders of the signed-in account; returns the function that stops them. */
export function startReminders(id: string): () => void {
  userId = id;
  lastSent = '';
  serverReady = true;
  const unsubs = [
    useCalendar.subscribe((s, p) => s.events !== p.events && planSoon()),
    useTodos.subscribe((s, p) => s.todos !== p.todos && planSoon()),
    useSettings.subscribe((s, p) => s.defaultReminders !== p.defaultReminders && planSoon()),
  ];
  const hourly = setInterval(plan, 3_600_000);
  const onVisible = () => document.visibilityState === 'visible' && planSoon();
  document.addEventListener('visibilitychange', onVisible);
  navigator.serviceWorker?.addEventListener('message', onWorkerMessage);
  void (async () => {
    await refreshDevice().catch(() => undefined);
    push = await pushActive().catch(() => false);
    if (userId === id) plan();
  })();
  return () => {
    unsubs.forEach(u => u());
    clearInterval(hourly);
    clearTimeout(planTimer);
    document.removeEventListener('visibilitychange', onVisible);
    navigator.serviceWorker?.removeEventListener('message', onWorkerMessage);
    timers.forEach(clearTimeout);
    timers = [];
    userId = null;
  };
}

/** After notifications were turned on or off on this device (Profil › Notifications). */
export async function devicePushChanged() {
  push = await pushActive().catch(() => false);
  plan();
}
