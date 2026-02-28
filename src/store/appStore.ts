import { create } from 'zustand';
import type { AppView } from '../types';

interface AppState {
  view: AppView;
  searchQuery: string;
  isSearchOpen: boolean;
  setView: (view: AppView) => void;
  setSearchQuery: (q: string) => void;
  setSearchOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'dashboard',
  searchQuery: '',
  isSearchOpen: false,
  setView: (view) => set({ view }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),
}));
