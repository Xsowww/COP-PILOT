import { create } from 'zustand';
import type { CopSuggestion } from '../types';

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

interface CopState {
  suggestions: CopSuggestion[];
  addSuggestion: (msg: string, actions: { label: string; handler: () => void }[], meta?: { relatedEntityId?: string; relatedEntityType?: 'file' | 'event' | 'note' }) => void;
  dismissSuggestion: (id: string) => void;
  dismissAll: () => void;
}

export const useCopStore = create<CopState>((set) => ({
  suggestions: [],

  addSuggestion: (message, actions, meta = {}) => {
    const suggestion: CopSuggestion = {
      id: generateId(),
      message,
      actions,
      ...meta,
    };
    set(s => ({ suggestions: [...s.suggestions, suggestion] }));
    // Auto-dismiss after 12s
    setTimeout(() => {
      set(s => ({ suggestions: s.suggestions.filter(sg => sg.id !== suggestion.id) }));
    }, 12000);
  },

  dismissSuggestion: (id) => {
    set(s => ({ suggestions: s.suggestions.filter(sg => sg.id !== id) }));
  },

  dismissAll: () => set({ suggestions: [] }),
}));
