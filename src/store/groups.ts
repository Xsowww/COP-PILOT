import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { todayKey } from '../lib/dates';
import * as api from '../lib/groups';
import type { Attendance, Group, GroupEvent, GroupMember, GroupNoteSummary } from '../lib/groups';

// Groupes de travail (en ligne seulement). Rien n'est gardé dans le navigateur : tout est relu
// depuis Supabase à l'ouverture, en direct (Realtime) et quand l'onglet reprend la main.

interface GroupsState {
  groups: Group[];
  loaded: boolean;
  failed: boolean;
  activeId: string | null;
  members: Record<string, GroupMember[]>;
  notes: Record<string, GroupNoteSummary[]>;
  events: Record<string, GroupEvent[]>;
  attendance: Record<string, Attendance[]>;
  loadGroups: () => Promise<void>;
  /** Ouvre un groupe : charge son contenu et écoute les changements des autres membres. */
  open: (id: string | null) => void;
  refresh: (id: string, parts?: Part[]) => Promise<void>;
  upsertNote: (n: GroupNoteSummary) => void;
  dropNote: (groupId: string, id: string) => void;
  /** Vide tout (déconnexion, changement de compte). */
  reset: () => void;
}

type Part = 'members' | 'notes' | 'events';

let channel: RealtimeChannel | null = null;
let channelGroup: string | null = null;
const timers: Partial<Record<string, ReturnType<typeof setTimeout>>> = {};

export const useGroups = create<GroupsState>((set, get) => {
  /** Regroupe les rafales d'événements Realtime en une seule relecture. */
  const soon = (gid: string, part: Part | 'groups') => {
    const k = gid + part;
    clearTimeout(timers[k]);
    timers[k] = setTimeout(() => {
      if (part === 'groups') void get().loadGroups();
      else if (get().activeId === gid) void get().refresh(gid, [part]);
    }, 250);
  };

  const subscribe = (gid: string | null) => {
    if (!supabase || channelGroup === gid) return;
    if (channel) void supabase.removeChannel(channel);
    channel = null;
    channelGroup = gid;
    if (!gid) return;
    const f = `group_id=eq.${gid}`;
    channel = supabase
      .channel(`groupe-${gid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_notes', filter: f }, () => soon(gid, 'notes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_events', filter: f }, () => soon(gid, 'events'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_event_attendees', filter: f }, () => soon(gid, 'events'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: f }, () => (soon(gid, 'members'), soon(gid, 'groups')))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${gid}` }, () => soon(gid, 'groups'))
      // Les suppressions ne sont pas filtrables côté Realtime : on reçoit seulement des identifiants.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_notes' }, p => {
        const id = String((p.old as { id?: string }).id ?? '');
        if (get().notes[gid]?.some(n => n.id === id)) get().dropNote(gid, id);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_events' }, () => soon(gid, 'events'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_event_attendees' }, () => soon(gid, 'events'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_members' }, () => (soon(gid, 'members'), soon(gid, 'groups')))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'groups' }, () => soon(gid, 'groups'))
      .subscribe();
  };

  return {
    groups: [],
    loaded: false,
    failed: false,
    activeId: null,
    members: {},
    notes: {},
    events: {},
    attendance: {},

    async loadGroups() {
      try {
        const groups = await api.fetchGroups();
        set({ groups, loaded: true, failed: false });
      } catch {
        set({ loaded: true, failed: true });
      }
    },

    open(id) {
      set({ activeId: id });
      subscribe(id);
      if (id) void get().refresh(id);
    },

    async refresh(id, parts = ['members', 'notes', 'events']) {
      const jobs: Promise<unknown>[] = [];
      if (parts.includes('members')) jobs.push(api.fetchMembers(id).then(m => set(s => ({ members: { ...s.members, [id]: m } }))));
      if (parts.includes('notes')) jobs.push(api.fetchNotes(id).then(n => set(s => ({ notes: { ...s.notes, [id]: n } }))));
      if (parts.includes('events'))
        jobs.push(
          api.fetchEvents(id, todayKey()).then(r => set(s => ({ events: { ...s.events, [id]: r.events }, attendance: { ...s.attendance, [id]: r.attendance } }))),
        );
      const res = await Promise.allSettled(jobs);
      // Plus membre (retiré par le propriétaire, groupe supprimé) : la liste des groupes le dira.
      if (res.some(r => r.status === 'rejected')) void get().loadGroups();
    },

    upsertNote(n) {
      set(s => {
        const list = (s.notes[n.groupId] ?? []).filter(x => x.id !== n.id);
        return { notes: { ...s.notes, [n.groupId]: [n, ...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) } };
      });
    },

    dropNote(groupId, id) {
      set(s => ({ notes: { ...s.notes, [groupId]: (s.notes[groupId] ?? []).filter(n => n.id !== id) } }));
    },

    reset() {
      subscribe(null);
      set({ groups: [], loaded: false, failed: false, activeId: null, members: {}, notes: {}, events: {}, attendance: {} });
    },
  };
});

/** Relit tout quand on revient sur l'onglet (au cas où le temps réel a décroché). */
export function watchFocus(): () => void {
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    const { activeId, loadGroups, refresh } = useGroups.getState();
    void loadGroups();
    if (activeId) void refresh(activeId);
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  };
}
