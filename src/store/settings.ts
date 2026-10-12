import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { userStorage } from '../lib/userStorage';

export type AccentKey = 'orange' | 'bleu' | 'vert' | 'violet' | 'rose' | 'encre';
export type Chattiness = 'calme' | 'normal' | 'bavard';
export type ThemeMode = 'clair' | 'sombre' | 'auto';
export type Language = 'fr' | 'en';
/** Copilot's personality presets (the server turns them into instructions). */
export type PersonaKey = 'pote' | 'coach' | 'prof' | 'zen' | 'taquin';

export const ACCENTS: Record<AccentKey, { label: string; shades: Record<'50' | '100' | '200' | '500' | '600' | '700', string> }> = {
  orange: { label: 'Orange', shades: { 50: '#fdf3ef', 100: '#fbe4da', 200: '#f6c6b2', 500: '#e8613c', 600: '#d24e2a', 700: '#ad3e20' } },
  bleu: { label: 'Bleu', shades: { 50: '#eff4fe', 100: '#dce7fc', 200: '#b9cef8', 500: '#3b6fd8', 600: '#2c5bc0', 700: '#23489a' } },
  vert: { label: 'Vert', shades: { 50: '#ecf8f2', 100: '#d3efe1', 200: '#a6dec3', 500: '#2f9e6b', 600: '#238556', 700: '#1c6a45' } },
  violet: { label: 'Violet', shades: { 50: '#f4f1fd', 100: '#e7e0fb', 200: '#cfc1f6', 500: '#7a5ad6', 600: '#6545bf', 700: '#51379b' } },
  rose: { label: 'Framboise', shades: { 50: '#fdf0f4', 100: '#fbdde7', 200: '#f5b6cb', 500: '#d6457a', 600: '#bc3166', 700: '#962752' } },
  encre: { label: 'Encre', shades: { 50: '#f5f5f4', 100: '#e7e5e4', 200: '#d6d3d1', 500: '#44403c', 600: '#292524', 700: '#1c1917' } },
};

export const AVATAR_COLORS = ['#e8613c', '#3b6fd8', '#2f9e6b', '#7a5ad6', '#d6457a', '#d48a17', '#1f8fa8', '#44403c'];

export interface Settings {
  // profile
  avatarColor: string;
  avatarImage: string | null; // small data URL
  school: string;
  program: string;
  year: string;
  // appearance
  accent: AccentKey;
  reduceMotion: boolean;
  theme: ThemeMode;
  language: Language;
  // Copilot
  copilotVisible: boolean;
  proactive: boolean;
  eventReminders: boolean;
  chattiness: Chattiness;
  revisionSessions: number;
  revisionTime: string; // HH:mm
  persona: PersonaKey;
  personaNotes: string; // free instructions written by the student (max 600 chars)
  voiceReplies: boolean; // Copilot reads its answers aloud
  morningBrief: boolean; // « ta journée en 3 lignes »
  weeklyReview: boolean; // Sunday evening review
  // studies
  focusMinutes: number;
  breakMinutes: number;
  focusSessions: number; // completed, all time
  focusTotalMinutes: number;
  // notifications
  browserNotifications: boolean;
  focusSound: boolean;
  // motivation
  badgesSeen: string[]; // badges already announced
}

export const DEFAULT_SETTINGS: Settings = {
  avatarColor: AVATAR_COLORS[0],
  avatarImage: null,
  school: '',
  program: '',
  year: '',
  accent: 'orange',
  reduceMotion: false,
  theme: 'clair',
  language: 'fr',
  copilotVisible: true,
  proactive: true,
  eventReminders: true,
  chattiness: 'normal',
  revisionSessions: 3,
  revisionTime: '18:00',
  persona: 'pote',
  personaNotes: '',
  voiceReplies: false,
  morningBrief: true,
  weeklyReview: true,
  focusMinutes: 25,
  breakMinutes: 5,
  focusSessions: 0,
  focusTotalMinutes: 0,
  browserNotifications: false,
  focusSound: true,
  badgesSeen: [],
};

interface SettingsState extends Settings {
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    set => ({
      ...DEFAULT_SETTINGS,
      set: patch => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    { name: 'settings', storage: userStorage, skipHydration: true },
  ),
);

export const getSettings = () => useSettings.getState();

/** Push the accent colour and motion preference into CSS. */
export function applyAppearance(s: Pick<Settings, 'accent' | 'reduceMotion'>) {
  const root = document.documentElement;
  const shades = ACCENTS[s.accent]?.shades ?? ACCENTS.orange.shades;
  for (const [k, v] of Object.entries(shades)) root.style.setProperty(`--color-brand-${k}`, v);
  root.classList.toggle('reduce-motion', s.reduceMotion);
}
