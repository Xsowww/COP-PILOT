import { createClient } from '@supabase/supabase-js';
import { captchaToken } from './captcha';

// When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (see .env.example), accounts and
// data live in Supabase. Otherwise the app keeps working fully offline in this browser.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Error carried back by a Supabase e-mail link (expired or already used link…).
 * Read before the Supabase client initialises, because the client clears the URL.
 */
export const linkError: string | null = (() => {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const code = params.get('error_code') ?? params.get('error');
  if (!code) return null;
  if (code === 'otp_expired') {
    return "Ce lien a expiré ou a déjà été utilisé. Si tu avais déjà cliqué dessus, ton compte est peut-être déjà activé : essaie de te connecter. Sinon, renvoie un e-mail de confirmation.";
  }
  return 'Ce lien n’est pas valide. Essaie de te connecter ou demande un nouvel e-mail.';
})();

// « Rester connecté » : the session is kept in localStorage (still there when the browser reopens, on this
// device only) unless the student unticked it, then in sessionStorage (gone when the tab closes).
const REMEMBER = 'cop-remember';
const keep = () => {
  try {
    return localStorage.getItem(REMEMBER) !== '0';
  } catch {
    return true;
  }
};
export function setRememberMe(on: boolean) {
  try {
    if (on) localStorage.removeItem(REMEMBER);
    else localStorage.setItem(REMEMBER, '0');
  } catch {
    /* storage blocked: the default (kept) applies */
  }
}
/** True when the session is kept on this device (« Rester connecté » ticked). */
export const remembered = keep;

/** Where Supabase keeps the current session (its default key): emptied to add another account without signing out. */
export const authStorageKey = url ? `sb-${new URL(url).hostname.split('.')[0]}-auth-token` : '';

const authStorage = {
  getItem: (k: string) => (keep() ? localStorage : sessionStorage).getItem(k),
  setItem: (k: string, v: string) => {
    (keep() ? localStorage : sessionStorage).setItem(k, v);
    (keep() ? sessionStorage : localStorage).removeItem(k);
  },
  removeItem: (k: string) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  },
};

export const supabase = url && key ? createClient(url, key, { auth: { storage: authStorage, persistSession: true, autoRefreshToken: true } }) : null;

/**
 * Checks a password without touching the current session (which may already be
 * verified with the second factor): a throwaway client signs in, then forgets.
 */
/** False for a wrong password; any other failure (network, too many tries) is thrown, not taken for one. */
export async function checkPassword(email: string, password: string): Promise<boolean> {
  if (!url || !key) return false;
  const tmp = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cop-pilot-check' } });
  const { error } = await tmp.auth.signInWithPassword({ email, password, options: { captchaToken: await captchaToken() } });
  if (!error) await tmp.auth.signOut({ scope: 'local' });
  if (error && error.code !== 'invalid_credentials' && !/invalid login/i.test(error.message)) throw error;
  return !error;
}
export const cloudEnabled = supabase !== null;

/** Ends a session kept for an account that is not the one in use (« Retirer de cet appareil »). */
export async function revokeSession(session: { access_token: string; refresh_token: string }) {
  if (!url || !key) return;
  const tmp = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cop-pilot-revoke' } });
  const { error } = await tmp.auth.setSession(session);
  if (!error) await tmp.auth.signOut({ scope: 'local' });
}

/** Access token of the signed-in user, to authenticate calls to our own server. */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}


/** Vrai si le compte connecté est déclaré dans public.admins (tableau de bord /admin). */
export async function checkIsAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}
