import { create } from 'zustand';
import type { ChatMessage } from '../types';

function genId() {
  return Math.random().toString(36).substring(2, 10);
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'cop',
  text: "Yooo, COP dans la place ! 🤜🤛 Je suis ton copilote perso — notes, calendrier, fichiers... je gère tout ça avec style. T'as besoin de quoi ?",
  timestamp: new Date(),
};

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  unreadCount: number;
  isTyping: boolean;
  addMessage: (role: 'cop' | 'user', text: string) => void;
  addCopMessage: (text: string) => void;
  toggleChat: () => void;
  openChat: () => void;
  markAsRead: () => void;
  setTyping: (v: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [WELCOME],
  isOpen: false,
  unreadCount: 0,
  isTyping: false,

  addMessage: (role, text) => {
    const msg: ChatMessage = { id: genId(), role, text, timestamp: new Date() };
    set(s => ({
      messages: [...s.messages, msg],
      unreadCount: (!s.isOpen && role === 'cop') ? s.unreadCount + 1 : s.unreadCount,
    }));
  },

  addCopMessage: (text) => get().addMessage('cop', text),

  toggleChat: () => {
    const willOpen = !get().isOpen;
    set({ isOpen: willOpen, unreadCount: willOpen ? 0 : get().unreadCount });
  },

  openChat: () => set({ isOpen: true, unreadCount: 0 }),
  markAsRead: () => set({ unreadCount: 0 }),
  setTyping: (v) => set({ isTyping: v }),
}));
