import { createJSONStorage } from 'zustand/middleware';
import { useUi } from '../store/ui';
import { cloudEnabled } from './supabase';

// Every data store is persisted under a key prefixed by the signed-in user's id,
// so each account on this browser has its own Drive, calendar and notes.

let currentUserId: string | null = null;

export function setStorageUser(id: string | null) {
  currentUserId = id;
}

export function getStorageUser() {
  return currentUserId;
}

export const userStorage = createJSONStorage(() => ({
  getItem: (name: string) => (currentUserId ? localStorage.getItem(`cop:${currentUserId}:${name}`) : null),
  setItem: (name: string, value: string) => {
    if (!currentUserId) return;
    try {
      localStorage.setItem(`cop:${currentUserId}:${name}`, value);
    } catch {
      // Browser storage full (usually many images pasted in notes). Without this, the error
      // would surface in whatever action changed the store and break it halfway.
      warnFull();
    }
  },
  removeItem: (name: string) => {
    if (currentUserId) localStorage.removeItem(`cop:${currentUserId}:${name}`);
  },
}));

let warnedFull = false;
function warnFull() {
  if (warnedFull) return;
  warnedFull = true;
  useUi.getState().toast(
    cloudEnabled
      ? 'Mémoire du navigateur pleine : tout reste enregistré en ligne, mais plus hors ligne sur cet appareil. Allège les images de tes notes.'
      : 'Mémoire du navigateur pleine : les dernières modifications risquent de ne pas être gardées. Allège les images de tes notes ou exporte une sauvegarde.',
    'error',
  );
}

export function blobKey(itemId: string) {
  return `${currentUserId}:${itemId}`;
}
