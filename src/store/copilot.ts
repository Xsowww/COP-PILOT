import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, nowIso } from '../lib/utils';
import { userStorage } from '../lib/userStorage';

export interface CopilotLink {
  label: string;
  to: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  links?: CopilotLink[];
  at: string;
}

/** hidden: only fingers on the edge · peek: head leans out · open: talking with the user */
export type CopilotPose = 'hidden' | 'peek' | 'open';

interface CopilotState {
  messages: CopilotMessage[];
  pose: CopilotPose;
  bubble: { text: string; links?: CopilotLink[] } | null;
  thinking: boolean;
  apiKey: string;
  offsetY: number; // vertical position along the screen edge, 0..1
  push: (role: CopilotMessage['role'], text: string, links?: CopilotLink[]) => void;
  setPose: (pose: CopilotPose) => void;
  say: (text: string, links?: CopilotLink[]) => void;
  clearBubble: () => void;
  setThinking: (v: boolean) => void;
  setApiKey: (k: string) => void;
  setOffsetY: (y: number) => void;
  clearHistory: () => void;
  reset: () => void;
}

const MAX_MESSAGES = 60;

let bubbleTimer: ReturnType<typeof setTimeout> | undefined;

export const useCopilot = create<CopilotState>()(
  persist(
    (set, get) => ({
      messages: [],
      pose: 'hidden',
      bubble: null,
      thinking: false,
      apiKey: '',
      offsetY: 0.62,

      push: (role, text, links) =>
        set(s => ({ messages: [...s.messages, { id: uid(), role, text, links, at: nowIso() }].slice(-MAX_MESSAGES) })),

      setPose: pose => set({ pose }),

      /** Proactive remark: Copilot leans out and says something short. */
      say(text, links) {
        if (get().pose === 'open') {
          get().push('bot', text, links);
          return;
        }
        clearTimeout(bubbleTimer);
        set({ bubble: { text, links }, pose: 'peek' });
        bubbleTimer = setTimeout(() => {
          if (get().pose !== 'open') set({ bubble: null, pose: 'hidden' });
        }, 7000);
      },

      clearBubble() {
        clearTimeout(bubbleTimer);
        set({ bubble: null });
      },

      setThinking: thinking => set({ thinking }),
      setApiKey: apiKey => set({ apiKey: apiKey.trim() }),
      setOffsetY: offsetY => set({ offsetY: Math.min(0.9, Math.max(0.12, offsetY)) }),
      clearHistory: () => set({ messages: [] }),
      reset: () => set({ messages: [], pose: 'hidden', bubble: null, thinking: false, apiKey: '', offsetY: 0.62 }),
    }),
    {
      name: 'copilot',
      storage: userStorage,
      skipHydration: true,
      partialize: s => ({ messages: s.messages, apiKey: s.apiKey, offsetY: s.offsetY }),
    },
  ),
);
