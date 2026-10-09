import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, nowIso } from '../lib/utils';
import { userStorage } from '../lib/userStorage';
import type { CopilotMood } from '../copilot/Character';

export interface CopilotLink {
  label: string;
  to: string;
}

/** A button Copilot offers (serialisable, executed by copilot/offers.ts). */
export interface CopilotOffer {
  label: string;
  kind: 'plan_revisions' | 'revision_note' | 'mark_done' | 'open';
  payload?: Record<string, string>;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  links?: CopilotLink[];
  offers?: CopilotOffer[];
  proactive?: boolean;
  at: string;
}

/** hidden: only the hands hold the edge · peek: head leans out · open: talking with the user */
export type CopilotPose = 'hidden' | 'peek' | 'open';

export interface Bubble {
  text: string;
  links?: CopilotLink[];
  offers?: CopilotOffer[];
  mood?: CopilotMood;
}

interface CopilotState {
  messages: CopilotMessage[];
  pose: CopilotPose;
  bubble: Bubble | null;
  thinking: boolean;
  aiEnabled: boolean;
  offsetY: number; // vertical position along the screen edge, 0..1
  /** when each proactive remark was last made, to avoid repeating ourselves */
  memory: Record<string, number>;
  /** the last proposal made, so that a plain "oui" can accept it */
  pendingOffer: CopilotOffer | null;
  push: (role: CopilotMessage['role'], text: string, extra?: Partial<Pick<CopilotMessage, 'links' | 'offers' | 'proactive'>>) => void;
  setPose: (pose: CopilotPose) => void;
  say: (bubble: Bubble) => void;
  clearBubble: () => void;
  setThinking: (v: boolean) => void;
  setAiEnabled: (v: boolean) => void;
  setOffsetY: (y: number) => void;
  remember: (key: string) => void;
  clearHistory: () => void;
  reset: () => void;
}

const MAX_MESSAGES = 80;
let bubbleTimer: ReturnType<typeof setTimeout> | undefined;

export const useCopilot = create<CopilotState>()(
  persist(
    (set, get) => ({
      messages: [],
      pose: 'hidden',
      bubble: null,
      thinking: false,
      aiEnabled: false,
      offsetY: 0.62,
      memory: {},
      pendingOffer: null,

      push: (role, text, extra = {}) =>
        set(s => ({
          messages: [...s.messages, { id: uid(), role, text, at: nowIso(), ...extra }].slice(-MAX_MESSAGES),
          pendingOffer: role === 'bot' ? (extra.offers?.[0] ?? null) : s.pendingOffer,
        })),

      setPose: pose => set({ pose }),

      /** Proactive remark: Copilot leans out and says something; it is also kept in the conversation. */
      say(bubble) {
        get().push('bot', bubble.text, { links: bubble.links, offers: bubble.offers, proactive: true });
        if (get().pose === 'open') return;
        clearTimeout(bubbleTimer);
        set({ bubble, pose: 'peek' });
        bubbleTimer = setTimeout(() => {
          if (get().pose !== 'open') set({ bubble: null, pose: 'hidden' });
        }, bubble.offers?.length ? 16000 : 9000);
      },

      clearBubble() {
        clearTimeout(bubbleTimer);
        set(s => ({ bubble: null, pose: s.pose === 'peek' ? 'hidden' : s.pose }));
      },

      setThinking: thinking => set({ thinking }),
      setAiEnabled: aiEnabled => set({ aiEnabled }),
      setOffsetY: offsetY => set({ offsetY: Math.min(0.88, Math.max(0.14, offsetY)) }),
      remember: key => set(s => ({ memory: { ...s.memory, [key]: Date.now() } })),
      clearHistory: () => set({ messages: [], pendingOffer: null }),
      reset: () => set({ messages: [], pose: 'hidden', bubble: null, thinking: false, offsetY: 0.62, memory: {}, pendingOffer: null }),
    }),
    {
      name: 'copilot',
      storage: userStorage,
      skipHydration: true,
      partialize: s => ({ messages: s.messages, offsetY: s.offsetY, memory: s.memory }),
    },
  ),
);
