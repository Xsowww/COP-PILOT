import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { toast } from '../store/ui';

// Groupes de travail : uniquement en ligne. Appels directs à Supabase (tables group_* et
// fonctions de supabase/migrations/2026-10-13_groupes.sql), indépendants de cloudSync.

export const GROUP_COLORS = ['#e8613c', '#3b6fd8', '#2f9e6b', '#7a5ad6', '#d48a17', '#1f8a8a'] as const;

export interface Group {
  id: string;
  name: string;
  color: string | null;
  inviteCode: string;
  ownerId: string | null;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  name: string;
  joinedAt: string;
  isOwner: boolean;
}

export interface GroupNote {
  id: string;
  groupId: string;
  title: string;
  content: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Note dans la liste (sans son contenu, chargé à l'ouverture). */
export type GroupNoteSummary = Omit<GroupNote, 'content'>;

export interface GroupEvent {
  id: string;
  groupId: string;
  title: string;
  date: string; // YYYY-MM-DD
  start: string | null;
  end: string | null;
  place: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface Attendance {
  eventId: string;
  userId: string;
}

export type NewGroupEvent = Pick<GroupEvent, 'title' | 'date' | 'start' | 'end' | 'place'>;

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));

const toGroup = (r: Row): Group => ({
  id: String(r.id),
  name: String(r.name),
  color: s(r.color),
  inviteCode: String(r.invite_code),
  ownerId: s(r.owner_id),
  createdAt: String(r.created_at),
});

export const toNote = (r: Row): GroupNote => ({
  id: String(r.id),
  groupId: String(r.group_id),
  title: String(r.title ?? 'Sans titre'),
  content: String(r.content ?? ''),
  createdBy: s(r.created_by),
  updatedBy: s(r.updated_by),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});

export const toEvent = (r: Row): GroupEvent => ({
  id: String(r.id),
  groupId: String(r.group_id),
  title: String(r.title),
  date: String(r.date),
  start: s(r.start_time),
  end: s(r.end_time),
  place: s(r.place),
  createdBy: s(r.created_by),
  createdAt: String(r.created_at),
});

function db(): SupabaseClient {
  if (!supabase) throw new Error('Les groupes nécessitent la version en ligne.');
  return supabase;
}

/** Message lisible pour une erreur Supabase / réseau. */
export function groupError(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? e ?? '');
  if (/too many attempts/i.test(msg)) return 'Trop de codes essayés. Réessaie dans un quart d’heure.';
  if (/group full/i.test(msg)) return 'Ce groupe est complet (50 membres).';
  if (/too many groups/i.test(msg)) return 'Tu fais déjà partie de 30 groupes, c’est le maximum.';
  if (/mfa required/i.test(msg)) return 'Confirme d’abord ta connexion avec le code de ton téléphone.';
  if (/forbidden|row-level security|permission denied/i.test(msg)) return 'Tu n’as pas le droit de faire ça dans ce groupe.';
  if (/fetch|network/i.test(msg)) return 'Pas de connexion. Réessaie dans un instant.';
  return 'Une erreur est survenue. Réessaie.';
}

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

/** The database silently skips rows it doesn't allow: say so instead of pretending it worked. */
function changed(res: { data: unknown; error: unknown }, refused: string) {
  const rows = check(res) as unknown[] | null;
  if (!rows || rows.length === 0) throw new Error(refused);
}

/** The account actually signed in (the one the database sees), not the one a stale tab displays. */
export async function sessionUserId(): Promise<string> {
  const { data } = await db().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Ta session a expiré. Reconnecte-toi.');
  return id;
}

// ── Groupes et membres ────────────────────────────────────────────────────
export async function fetchGroups(): Promise<Group[]> {
  const rows = check(await db().from('groups').select('*').order('created_at'));
  return (rows as Row[]).map(toGroup);
}

export async function createGroup(name: string, color: string | null): Promise<Group> {
  const row = check(await db().rpc('create_group', { p_name: name, p_color: color }));
  return toGroup(row as Row);
}

/** Renvoie l'identifiant du groupe rejoint, ou null si le code n'existe pas. */
export async function joinGroup(code: string): Promise<string | null> {
  const id = check(await db().rpc('join_group', { p_code: code }));
  return id ? String(id) : null;
}

export async function updateGroup(id: string, patch: { name?: string; color?: string | null }) {
  changed(await db().from('groups').update(patch).eq('id', id).select('id'), 'Seul le propriétaire peut modifier ce groupe.');
}

export async function deleteGroup(id: string) {
  changed(await db().from('groups').delete().eq('id', id).select('id'), 'Seul le propriétaire peut supprimer ce groupe.');
}

export async function regenerateCode(id: string): Promise<string> {
  return String(check(await db().rpc('regenerate_group_code', { p_group: id })));
}

export async function fetchMembers(groupId: string): Promise<GroupMember[]> {
  const rows = check(await db().rpc('group_member_list', { p_group: groupId }));
  return ((rows ?? []) as Row[]).map(r => ({
    userId: String(r.user_id),
    name: String(r.name),
    joinedAt: String(r.joined_at),
    isOwner: r.is_owner === true,
  }));
}

/** Retirer un membre (propriétaire seulement). */
export async function removeMember(groupId: string, userId: string) {
  changed(
    await db().from('group_members').delete().eq('group_id', groupId).eq('user_id', userId).select('user_id'),
    'Seul le propriétaire peut retirer un membre.',
  );
}

/** Quitter le groupe avec le compte réellement connecté. */
export async function leaveGroup(groupId: string) {
  const me = await sessionUserId();
  changed(await db().from('group_members').delete().eq('group_id', groupId).eq('user_id', me).select('user_id'), 'Tu ne fais plus partie de ce groupe.');
}

// ── Notes partagées ───────────────────────────────────────────────────────
export async function fetchNotes(groupId: string): Promise<GroupNoteSummary[]> {
  const rows = check(
    await db().from('group_notes').select('id, group_id, title, created_by, updated_by, created_at, updated_at').eq('group_id', groupId).order('updated_at', { ascending: false }),
  );
  return (rows as Row[]).map(r => summary(toNote(r)));
}

export function summary({ content: _c, ...rest }: GroupNote): GroupNoteSummary {
  return rest;
}

export async function fetchNote(id: string): Promise<GroupNote | null> {
  const row = check(await db().from('group_notes').select('*').eq('id', id).maybeSingle());
  return row ? toNote(row as Row) : null;
}

export async function createNote(groupId: string, title = 'Sans titre', content = ''): Promise<GroupNote> {
  const row = check(await db().from('group_notes').insert({ group_id: groupId, title, content }).select('*').single());
  return toNote(row as Row);
}

/**
 * Enregistre seulement si personne n'a modifié la note depuis `base` (date connue côté client).
 * Renvoie la note enregistrée, ou null si la version en ligne est plus récente (conflit).
 * Sans `base`, écrase quoi qu'il arrive (« garder ma version »).
 */
export async function saveNote(id: string, patch: { title?: string; content?: string }, base: string | null): Promise<GroupNote | null> {
  let q = db().from('group_notes').update(patch).eq('id', id);
  if (base) q = q.eq('updated_at', base);
  const rows = check(await q.select('*'));
  const row = (rows as Row[])[0];
  return row ? toNote(row) : null;
}

export async function deleteNote(id: string) {
  changed(await db().from('group_notes').delete().eq('id', id).select('id'), 'Cette note n’existe plus ou tu n’y as plus accès.');
}

// ── Révisions en commun ───────────────────────────────────────────────────
export async function fetchEvents(groupId: string, fromDate: string): Promise<{ events: GroupEvent[]; attendance: Attendance[] }> {
  const [ev, at] = await Promise.all([
    db().from('group_events').select('*').eq('group_id', groupId).gte('date', fromDate).order('date').order('start_time', { nullsFirst: true }),
    db().from('group_event_attendees').select('event_id, user_id').eq('group_id', groupId),
  ]);
  return {
    events: (check(ev) as Row[]).map(toEvent),
    attendance: (check(at) as Row[]).map(r => ({ eventId: String(r.event_id), userId: String(r.user_id) })),
  };
}

export async function createEvent(groupId: string, e: NewGroupEvent): Promise<GroupEvent> {
  const row = check(
    await db()
      .from('group_events')
      .insert({ group_id: groupId, title: e.title, date: e.date, start_time: e.start, end_time: e.end, place: e.place })
      .select('*')
      .single(),
  );
  return toEvent(row as Row);
}

export async function deleteEvent(id: string) {
  changed(await db().from('group_events').delete().eq('id', id).select('id'), 'Seul l’auteur de la séance ou le propriétaire peut l’annuler.');
}

export async function setAttendance(groupId: string, eventId: string, coming: boolean) {
  const me = await sessionUserId();
  if (coming) check(await db().from('group_event_attendees').upsert({ group_id: groupId, event_id: eventId, user_id: me }, { ignoreDuplicates: true }));
  else check(await db().from('group_event_attendees').delete().eq('event_id', eventId).eq('user_id', me));
}

export async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    toast('Code copié', 'success');
  } catch {
    toast(`Code d’invitation : ${code}`);
  }
}
