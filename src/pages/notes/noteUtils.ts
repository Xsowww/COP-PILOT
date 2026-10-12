import type { DriveItem } from '../../store/drive';
import type { CalendarEvent } from '../../store/calendar';
import { TRASH_DAYS } from '../../store/drive';

// ── Open editor bridge ─────────────────────────────────────────────
let flushOpen: (() => void) | null = null;
/** Called by NoteEditor with its flush function, and with (null, itself) when it unmounts. */
export const registerEditorFlush = (fn: (() => void) | null, prev?: () => void) => {
  if (fn || flushOpen === prev) flushOpen = fn;
};
/** Saves the open editor's pending changes right away (e.g. before an export). */
export const flushNoteEditor = () => flushOpen?.();

// ── Links ──────────────────────────────────────────────────────────
export const fileHref = (f: DriveItem) => (f.parentId ? `/drive?dossier=${f.parentId}&fichier=${f.id}` : `/drive?fichier=${f.id}`);
export const eventHref = (e: CalendarEvent) => `/calendrier?jour=${e.date}`;

// ── Trash ──────────────────────────────────────────────────────────
export function daysLeft(deletedAt?: string) {
  if (!deletedAt) return TRASH_DAYS;
  const elapsed = Math.floor((Date.now() - new Date(deletedAt).getTime()) / 864e5);
  return Math.max(0, TRASH_DAYS - elapsed);
}

export const leftLabel = (deletedAt?: string) => {
  const d = daysLeft(deletedAt);
  return d <= 0 ? 'supprimé aujourd’hui' : d === 1 ? 'supprimé demain' : `supprimé dans ${d} jours`;
};
