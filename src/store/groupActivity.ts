import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchGroups, sessionUserId, type Group } from '../lib/groups';
import { notify } from '../lib/notify';
import { getSettings, useSettings } from './settings';
import { toast } from './ui';
import { goTo } from '../copilot/actions';

// Pastilles et notifications « du nouveau dans tes groupes » : ce que les AUTRES membres ont ajouté
// ou modifié depuis ta dernière visite de l'onglet concerné. Tout passe par un recomptage depuis la
// base : déclenché en direct par le temps réel quand il fonctionne, et toutes les 30 s sinon
// (réseaux qui bloquent les WebSockets). Une notification part quand un compteur augmente.

export type ActivityTab = 'notes' | 'fichiers' | 'revisions';
type Counts = Partial<Record<ActivityTab, number>>;

const TABLES: { table: string; tab: ActivityTab; at: string; by: string; one: string; many: string }[] = [
  { table: 'group_notes', tab: 'notes', at: 'updated_at', by: 'updated_by', one: 'note', many: 'notes' },
  { table: 'group_files', tab: 'fichiers', at: 'created_at', by: 'created_by', one: 'fichier', many: 'fichiers' },
  { table: 'group_events', tab: 'revisions', at: 'created_at', by: 'created_by', one: 'révision', many: 'révisions' },
];
const POLL_MS = 30_000;

interface ActivityState {
  unread: Record<string, Counts>;
  /** Recompte depuis la base et prévient de ce qui est nouveau depuis le dernier comptage. */
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
let poll: ReturnType<typeof setInterval> | undefined;
let soon: ReturnType<typeof setTimeout> | undefined;
let names: Record<string, string> = {};
let counted = false; // le premier comptage ne notifie pas (ce qui attendait déjà est juste affiché)
const recount = () => void useGroupActivity.getState().count();

function watching(gid: string, tab: ActivityTab) {
  const q = new URLSearchParams(location.search);
  return !document.hidden && location.pathname === '/groupes' && q.get('g') === gid && (q.get('onglet') ?? 'notes') === tab;
}

function announce(gid: string, more: Counts) {
  const name = names[gid] ?? 'un de tes groupes';
  const parts = TABLES.filter(t => more[t.tab]).map(t => `${more[t.tab]} ${more[t.tab] === 1 ? t.one : t.many}`);
  const first = TABLES.find(t => more[t.tab])!.tab;
  const to = `/groupes?g=${gid}${first === 'notes' ? '' : `&onglet=${first}`}`;
  toast(`Du nouveau dans « ${name} » : ${parts.join(', ')}`, 'info', { label: 'Voir', run: () => goTo(to) });
  notify(`Du nouveau dans « ${name} »`, parts.join(', '));
}

export const useGroupActivity = create<ActivityState>((set, get) => ({
  unread: {},

  async count() {
    if (!supabase) return;
    const me = await sessionUserId().catch(() => null);
    if (!me) return;
    // Sa propre liste : celle du store est vidée et rechargée par la page Groupes à chaque visite.
    let groups: Group[];
    try {
      groups = await fetchGroups();
    } catch {
      return; // réseau coupé : on garde l'affichage actuel
    }
    names = Object.fromEntries(groups.map(g => [g.id, g.name]));

    // Groupe jamais visité sur ce compte : on part de maintenant (pas d'avalanche de vieilles pastilles).
    const now = new Date().toISOString();
    const missing = Object.fromEntries(
      groups.flatMap(g => TABLES.map(t => key(g.id, t.tab))).filter(k => !getSettings().groupsSeen[k]).map(k => [k, now]),
    );
    if (Object.keys(missing).length) useSettings.getState().set({ groupsSeen: { ...getSettings().groupsSeen, ...missing } });

    const unread: Record<string, Counts> = {};
    const results = await Promise.all(
      TABLES.map(async t => {
        const since = groups.map(g => seenAt(g.id, t.tab)).sort()[0];
        if (!since) return true;
        const { data, error } = await supabase!.from(t.table).select(`group_id, ${t.at}`).gt(t.at, since).neq(t.by, me);
        for (const r of (data ?? []) as unknown as Record<string, string>[]) {
          if (r[t.at] <= (seenAt(r.group_id, t.tab) ?? now)) continue;
          unread[r.group_id] = { ...unread[r.group_id], [t.tab]: (unread[r.group_id]?.[t.tab] ?? 0) + 1 };
        }
        return !error;
      }),
    );
    if (results.includes(false)) return; // réseau coupé : on garde l'affichage actuel

    // Ce que l'étudiant regarde en ce moment est vu, pas nouveau.
    for (const [gid, c] of Object.entries(unread)) {
      for (const t of TABLES) {
        if (!c[t.tab] || !watching(gid, t.tab)) continue;
        c[t.tab] = 0;
        get().markSeen(gid, t.tab);
      }
    }

    if (counted) {
      const before = get().unread;
      for (const [gid, c] of Object.entries(unread)) {
        const more: Counts = {};
        for (const t of TABLES) if ((c[t.tab] ?? 0) > (before[gid]?.[t.tab] ?? 0)) more[t.tab] = (c[t.tab] ?? 0) - (before[gid]?.[t.tab] ?? 0);
        if (Object.keys(more).length) announce(gid, more);
      }
    }
    counted = true;
    set({ unread });
  },

  async start() {
    if (!supabase || channel) return;
    // Réservé tout de suite : un second appel pendant le premier comptage ne doit pas recréer le canal.
    channel = supabase.channel('groupes-activite');
    await get().count();
    if (!channel) return; // arrêté entre-temps (déconnexion)
    // En direct quand le temps réel passe (la RLS ne laisse arriver que les groupes dont on est membre).
    for (const t of TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t.table }, () => {
        clearTimeout(soon);
        soon = setTimeout(recount, 1500); // une rafale de sauvegardes = un seul recomptage
      });
    }
    channel.subscribe();
    poll = setInterval(() => !document.hidden || getSettings().browserNotifications ? recount() : undefined, POLL_MS);
    addEventListener('focus', recount);
  },

  stop() {
    removeEventListener('focus', recount);
    clearInterval(poll);
    clearTimeout(soon);
    if (channel && supabase) void supabase.removeChannel(channel);
    channel = null;
    counted = false;
    set({ unread: {} });
  },

  markSeen(gid, tab) {
    if (!TABLES.some(t => t.tab === tab)) return;
    useSettings.getState().set({ groupsSeen: { ...getSettings().groupsSeen, [key(gid, tab)]: new Date().toISOString() } });
    if (get().unread[gid]?.[tab as ActivityTab]) set(s => ({ unread: { ...s.unread, [gid]: { ...s.unread[gid], [tab]: 0 } } }));
  },
}));
