import { createClient } from '@supabase/supabase-js';

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
  return "Ce lien n'est pas valide. Essaie de te connecter ou demande un nouvel e-mail.";
})();

export const supabase = url && key ? createClient(url, key) : null;
export const cloudEnabled = supabase !== null;

/** Access token of the signed-in user, to authenticate calls to our own server. */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

