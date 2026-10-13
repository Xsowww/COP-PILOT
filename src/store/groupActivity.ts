import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { sessionUserId } from '../lib/groups';
import { notify } from '../lib/notify';
import { getSettings, useSettings } from './settings';
import { useGroups } from './groups';
import { toast } from './ui';
import { goTo } from '../copilot/actions';

// Pastilles « du nouveau dans tes groupes » : ce que les AUTRES membres ont ajouté ou modifié
// depuis ta dernière visite de l'onglet concerné, compté au chargement puis en direct.

export type ActivityTab = 'notes' | 'fichiers' | 'revisions';
type Counts = Partial<Record<ActivityTab, number>>;

const TABLES: { table: string; tab: ActivityTab; at: string; by: string; what: string }[] = [
  { table: 'group_notes', tab: 'notes', at: 'updated_at', by: 'updated_by', what: 'Note' },
  { table: 'group_files', tab: 'fichiers', at: 'created_at', by: 'created_by', what: 'Nouveau fichier' },
  { table: 'group_events', tab: 'revisions', at: 'created_at', by: 'created_by', what: 'Nouvelle révision' },
];

interface ActivityState {
  unread: Record<string, Counts>;
  /** Recompte depuis la base (au démarrage et au retour sur l'onglet, si le temps réel a décroché). */
  count: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => void;
  /** L'étudiant regarde cet onglet : plus rien de nouveau dedans. */
  markSeen: (groupId: string, tab: string) => void;
}

const key = (gid: string, tab: string) => `${gid}:${tab}`;
const seenAt = (gid: string, tab: string) => getSettings().groupsSeen[key(gid, tab)];

export const totalUnread = (c: Counts = {}) => (c.notes ?? 0) + (c.fichiers ?? 0) + (c.revisions ?? 0);

let channel: RealtimeChannel | null = null;
const recount = () => void useGroupActivity.getState().count();

export const useGroupActivity = create<ActivityState>((set, get) => {
  const bump = (gid: string, tab: ActivityTab) =>
    set(s => ({ unread: { ...s.unread, [gid]: { ...s.unread[gid], [tab]: (s.unread[gid]?.[tab] ?? 0) + 1 } } }));

  return {
    unread: {},

    async count() {
      if (!supabase) return;
      const me = await sessionUserId().catch(() => null);
      if (!me) return;
      await useGroups.getState().loadGroups();
      const groups = useGroups.getState().groups;

      // Groupe jamais visité sur ce compte : on part de maintenant (pas d'avalanche de vieilles pastilles).
      const now = new Date().toISOString();
      const missing = Object.fromEntries(
        groups.flatMap(g => TABLES.map(t => key(g.id, t.tab))).filter(k => !getSettings().groupsSeen[k]).map(k => [k, now]),
      );
      if (Object.keys(missing).length) useSettings.getState().set({ groupsSeen: { ...getSettings().groupsSeen, ...missing } });

      const unread: Record<string, Counts> = {};
      await Promise.all(
        TABLES.map(async t => {
          const since = groups.map(g => seenAt(g.id, t.tab)).sort()[0];
          if (!since) return;
          const { data } = await supabase!.from(t.table).select(`group_id, ${t.at}, ${t.by}`).gt(t.at, since).neq(t.by, me);
          for (const r of (data ?? []) as unknown as Record<string, string>[]) {
            if (r[t.at] <= (seenAt(r.group_id, t.tab) ?? now)) continue;
            unread[r.group_id] = { ...unread[r.group_id], [t.tab]: (unread[r.group_id]?.[t.tab] ?? 0) + 1 };
          }
        }),
      );
      set({ unread });
    },

    async start() {
      if (!supabase || channel) return;
      await get().count();
      const me = await sessionUserId().catch(() => null);
      if (!me) return;

      // En direct : la RLS ne laisse passer que les groupes dont on est membre.
      channel = supabase.channel('groupes-activite');
      for (const t of TABLES) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: t.table }, p => {
          const row = p.new as Record<string, string>;
          if (p.eventType === 'DELETE' || !row?.group_id || row[t.by] === me) return;
          if (t.tab !== 'notes' && p.eventType !== 'INSERT') return;
          const { activeId } = useGroups.getState();
          const watching = activeId === row.group_id && new URLSearchParams(location.search).get('onglet') === (t.tab === 'notes' ? null : t.tab) && location.pathname === '/groupes' && !document.hidden;
          if (watching) return get().markSeen(row.group_id, t.tab);
          bump(row.group_id, t.tab);
          const name = useGroups.getState().groups.find(g => g.id === row.group_id)?.name ?? 'un groupe';
          const title = t.tab === 'notes' ? (p.eventType === 'INSERT' ? 'Nouvelle note' : 'Note modifiée') : t.what;
          const label = row.title || row.name || '';
          const to = `/groupes?g=${row.group_id}${t.tab === 'notes' ? '' : `&onglet=${t.tab}`}`;
          toast(`${title} dans « ${name} »${label ? ` : ${label}` : ''}`, 'info', { label: 'Voir', run: () => goTo(to) });
          notify(`${title} · ${name}`, label);
        });
      }
      channel.subscribe();
      addEventListener('focus', recount);
    },

    stop() {
      removeEventListener('focus', recount);
      if (channel && supabase) void supabase.removeChannel(channel);
      channel = null;
      set({ unread: {} });
    },

    markSeen(gid, tab) {
      if (!TABLES.some(t => t.tab === tab)) return;
      useSettings.getState().set({ groupsSeen: { ...getSettings().groupsSeen, [key(gid, tab)]: new Date().toISOString() } });
      if (get().unread[gid]?.[tab as ActivityTab]) set(s => ({ unread: { ...s.unread, [gid]: { ...s.unread[gid], [tab]: 0 } } }));
    },
  };
});
