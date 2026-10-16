import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { getSettings, useSettings } from './settings';

// What's new in my shared calendars (additions, changes, removals by the others, newcomers) since my last visit:
// the red badge on « Agendas » and on each calendar. Counted by the server from the notifications it sent me
// (RPC my_agenda_news); « last visit » is kept in the synced settings, so a visit on the phone clears the computer's.

const seenKey = (gid: string) => `${gid}:agenda`;
/** The calendar shown on screen right now (AgendasPage): its changes are seen live, nothing to announce. */
let viewing: string | null = null;

interface AgendaNews {
  news: Record<string, number>;
  refresh: () => Promise<void>;
  markSeen: (gid: string) => void;
}

export const useAgendaNews = create<AgendaNews>((set, get) => ({
  news: {},
  async refresh() {
    if (!supabase) return;
    const seen = Object.fromEntries(
      Object.entries(getSettings().groupsSeen)
        .filter(([k]) => k.endsWith(':agenda'))
        .map(([k, v]) => [k.slice(0, -':agenda'.length), v]),
    );
    const { data, error } = await supabase.rpc('my_agenda_news', { p_seen: seen });
    if (error || !Array.isArray(data)) return; // without the 2026-10-18c migration: no badge
    const news: Record<string, number> = Object.fromEntries((data as { group_id: string; news: number }[]).map(r => [r.group_id, r.news]));
    set({ news });
    if (viewing && news[viewing] && document.visibilityState === 'visible') get().markSeen(viewing);
  },
  markSeen(gid) {
    const seen = getSettings().groupsSeen;
    // Written only when there is something to clear (or never visited): the settings sync to every device.
    if (seen[seenKey(gid)] && !get().news[gid]) return;
    useSettings.getState().set({ groupsSeen: { ...seen, [seenKey(gid)]: new Date().toISOString() } });
    set(s => ({ news: { ...s.news, [gid]: 0 } }));
  },
}));

export const totalAgendaNews = (news: Record<string, number>) => Object.values(news).reduce((n, c) => n + c, 0);

export function setViewingAgenda(gid: string | null) {
  viewing = gid;
  if (gid && document.visibilityState === 'visible') useAgendaNews.getState().markSeen(gid);
}
export const viewingAgenda = () => (document.visibilityState === 'visible' ? viewing : null);

/** The badge kept up to date: now, every 2 minutes, and when the tab comes back. */
export function watchAgendaNews(): () => void {
  const refresh = () => document.visibilityState === 'visible' && void useAgendaNews.getState().refresh();
  refresh();
  const t = setInterval(refresh, 120_000);
  document.addEventListener('visibilitychange', refresh);
  return () => {
    clearInterval(t);
    document.removeEventListener('visibilitychange', refresh);
  };
}
