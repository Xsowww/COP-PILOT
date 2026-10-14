// Pause of the AI brain after the provider's quota was reached (simple mode meanwhile).
// shortcut: kept in this tab's sessionStorage, each tab finds the limit by itself (one failed call); fine for now.
const PAUSE_KEY = 'cop-ai-paused-until';

export function pauseAi(seconds: number) {
  try {
    sessionStorage.setItem(PAUSE_KEY, String(Date.now() + seconds * 1000));
  } catch {
    /* storage unavailable: the next call will simply hit the limit again */
  }
}

/** Time (ms) until which the AI is paused, or 0. */
export function aiPausedUntil(): number {
  try {
    const t = Number(sessionStorage.getItem(PAUSE_KEY));
    return t > Date.now() ? t : 0;
  } catch {
    return 0;
  }
}
