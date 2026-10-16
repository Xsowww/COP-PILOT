import { supabase } from '../../lib/supabase';

// Données de l'onglet « À traiter » (supabase/migrations/2026-10-16b_signalements_avis.sql).

export interface Report {
  id: string;
  kind: 'note' | 'file' | 'event';
  reason: string;
  message: string | null;
  snapshot: { title?: string; excerpt?: string; group?: string; date?: string; start?: string | null; place?: string | null; size?: number };
  status: 'open' | 'dismissed' | 'removed';
  created_at: string;
  reporter: string | null;
  author: string | null;
  still_there: boolean;
}

export interface Feedback {
  id: string;
  kind: 'idea' | 'bug';
  message: string;
  page: string | null;
  device: string | null;
  status: 'open' | 'done';
  created_at: string;
  email: string | null;
}

export interface Inbox {
  reports: Report[];
  feedback: Feedback[];
}

export const openCount = (inbox: Inbox | null) => (inbox ? inbox.reports.filter(r => r.status === 'open').length + inbox.feedback.filter(f => f.status === 'open').length : 0);

/** Fetches the reports and the « Avis ou bug » messages; `missing` while the migration isn't applied. */
export async function fetchInbox(): Promise<{ inbox: Inbox | null; missing: boolean }> {
  if (!supabase) return { inbox: null, missing: false };
  const { data, error } = await supabase.rpc('admin_inbox');
  if (error) return { inbox: null, missing: /admin_inbox|function|schema cache/i.test(error.message) };
  return { inbox: data as Inbox, missing: false };
}

