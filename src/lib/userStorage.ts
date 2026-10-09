import { createJSONStorage } from 'zustand/middleware';

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
    if (currentUserId) localStorage.setItem(`cop:${currentUserId}:${name}`, value);
  },
  removeItem: (name: string) => {
    if (currentUserId) localStorage.removeItem(`cop:${currentUserId}:${name}`);
  },
}));

export function blobKey(itemId: string) {
  return `${currentUserId}:${itemId}`;
}
