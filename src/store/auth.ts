import { create } from 'zustand';
import { uid, nowIso } from '../lib/utils';
import { setStorageUser } from '../lib/userStorage';

// Accounts live in this browser only (no server yet). Passwords are never stored
// in clear: we keep a salted PBKDF2 hash. Swap this module for a real backend later.

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface StoredUser extends User {
  salt: string;
  hash: string;
}

const USERS_KEY = 'cop:users';
const SESSION_KEY = 'cop:session';

function readUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function toHex(buf: ArrayBuffer | Uint8Array) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  if (crypto?.subtle) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120_000, hash: 'SHA-256' },
      key,
      256,
    );
    return toHex(bits);
  }
  // Insecure context fallback (e.g. plain http on a LAN IP): still not clear text.
  let h = 0;
  for (const c of salt + password) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return `weak-${h}`;
}

function publicUser({ salt: _s, hash: _h, ...u }: StoredUser): User {
  return u;
}

interface AuthState {
  user: User | null;
  register: (name: string, email: string, password: string) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  updateName: (name: string) => void;
}

function startSession(user: User) {
  localStorage.setItem(SESSION_KEY, user.id);
  setStorageUser(user.id);
}

function restoreSession(): User | null {
  const id = localStorage.getItem(SESSION_KEY);
  const found = id ? readUsers().find(u => u.id === id) : undefined;
  if (!found) return null;
  setStorageUser(found.id);
  return publicUser(found);
}

export const useAuth = create<AuthState>((set, get) => ({
  user: restoreSession(),

  async register(name, email, password) {
    const users = readUsers();
    const mail = email.trim().toLowerCase();
    if (users.some(u => u.email === mail)) throw new Error('Un compte existe déjà avec cet e-mail.');
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const stored: StoredUser = {
      id: uid(),
      name: name.trim(),
      email: mail,
      createdAt: nowIso(),
      salt,
      hash: await hashPassword(password, salt),
    };
    writeUsers([...users, stored]);
    const user = publicUser(stored);
    startSession(user);
    set({ user });
    return user;
  },

  async login(email, password) {
    const found = readUsers().find(u => u.email === email.trim().toLowerCase());
    if (!found || (await hashPassword(password, found.salt)) !== found.hash) {
      throw new Error('E-mail ou mot de passe incorrect.');
    }
    const user = publicUser(found);
    startSession(user);
    set({ user });
    return user;
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
    setStorageUser(null);
    set({ user: null });
  },

  updateName(name) {
    const user = get().user;
    if (!user) return;
    writeUsers(readUsers().map(u => (u.id === user.id ? { ...u, name } : u)));
    set({ user: { ...user, name } });
  },
}));
