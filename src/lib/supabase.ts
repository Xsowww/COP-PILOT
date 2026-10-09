import { createClient } from '@supabase/supabase-js';

// When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (see .env.example), accounts and
// data live in Supabase. Otherwise the app keeps working fully offline in this browser.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key ? createClient(url, key) : null;
export const cloudEnabled = supabase !== null;

/** Access token of the signed-in user, to authenticate calls to our own server. */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
