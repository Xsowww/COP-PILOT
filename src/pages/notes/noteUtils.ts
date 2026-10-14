import type { DriveItem } from '../../store/drive';
import type { CalendarEvent } from '../../store/calendar';

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
