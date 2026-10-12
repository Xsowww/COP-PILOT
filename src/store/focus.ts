import { create } from 'zustand';
import { getSettings, useSettings } from './settings';
import { useCopilot } from './copilot';
import { notify, chime } from '../lib/notify';
import { useFocusLog } from './focusLog';

export type FocusPhase = 'focus' | 'break';

interface FocusState {
  phase: FocusPhase | null; // null = idle
  endsAt: number;
  pausedLeft: number | null; // ms left while paused
  label: string;
  start: (label?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  tick: () => void;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export const useFocus = create<FocusState>((set, get) => ({
  phase: null,
  endsAt: 0,
  pausedLeft: null,
  label: '',

  start(label = '') {
    set({ phase: 'focus', endsAt: Date.now() + getSettings().focusMinutes * 60_000, pausedLeft: null, label });
  },
  pause() {
    const s = get();
    if (s.phase && s.pausedLeft === null) set({ pausedLeft: Math.max(0, s.endsAt - Date.now()) });
  },
  resume() {
    const s = get();
    if (s.phase && s.pausedLeft !== null) set({ endsAt: Date.now() + s.pausedLeft, pausedLeft: null });
  },
  stop: () => set({ phase: null, pausedLeft: null, label: '' }),

  /** Called every second by the timer widget; switches phases when time is up. */
  tick() {
    const s = get();
    if (!s.phase || s.pausedLeft !== null || Date.now() < s.endsAt) return;
    const settings = getSettings();
    if (settings.focusSound) chime();
    if (s.phase === 'focus') {
      useSettings.getState().set({
        focusSessions: settings.focusSessions + 1,
        focusTotalMinutes: settings.focusTotalMinutes + settings.focusMinutes,
      });
      useFocusLog.getState().log(s.label, settings.focusMinutes, new Date(Date.now() - settings.focusMinutes * 60_000).toISOString());
      const text = pick([
        `${settings.focusMinutes} minutes de concentration, bien joué. Pause de ${settings.breakMinutes} min : lève-toi, bois un verre d'eau.`,
        `Session terminée${s.label ? ` sur « ${s.label} »` : ''}. Tu as mérité ta pause de ${settings.breakMinutes} minutes.`,
      ]);
      useCopilot.getState().say({ text, mood: 'happy' });
      notify('Session terminée', `Pause de ${settings.breakMinutes} minutes.`);
      set({ phase: 'break', endsAt: Date.now() + settings.breakMinutes * 60_000 });
    } else {
      notify('Fin de la pause', 'On repart pour une session ?');
      useCopilot.getState().say({ text: 'Fin de la pause. On repart pour une session ?', mood: 'alert' });
      set({ phase: null, label: '' });
    }
  },
}));

export function focusLeft(s: Pick<FocusState, 'endsAt' | 'pausedLeft'>) {
  return s.pausedLeft ?? Math.max(0, s.endsAt - Date.now());
}

export const mmss = (ms: number) => {
  const t = Math.ceil(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
