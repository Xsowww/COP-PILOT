import { getSettings } from '../store/settings';

/** Desktop notification, only when the student enabled it and the tab is in the background. */
export function notify(title: string, body: string, force = false) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!getSettings().browserNotifications) return;
  if (!force && !document.hidden) return;
  try {
    new Notification(title, { body, icon: '/favicon.svg', tag: title });
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/** Short soft chime with the Web Audio API (no audio file needed). */
export function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* audio not available */
  }
}
