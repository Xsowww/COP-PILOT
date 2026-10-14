import { useNotes } from '../store/notes';
import { useCalendar } from '../store/calendar';
import { useTodos } from '../store/todos';
import { useSettings } from '../store/settings';

import { toKompa } from './kompaName';

/** One-time rename of the old name in an account's own notes, events and tasks (synced like any edit). */
export function renameToKompa() {
  if (useSettings.getState().renamedToKompa) return;
  const notes = useNotes.getState();
  for (const f of notes.folders) if (toKompa(f.name) !== f.name) notes.renameFolder(f.id, toKompa(f.name));
  for (const n of notes.notes) {
    if (toKompa(n.title) !== n.title || toKompa(n.content) !== n.content) notes.updateNote(n.id, { title: toKompa(n.title), content: toKompa(n.content) });
  }
  const cal = useCalendar.getState();
  for (const e of cal.events) {
    const details = e.details && toKompa(e.details);
    if (toKompa(e.title) !== e.title || details !== e.details) cal.update(e.id, { title: toKompa(e.title), details });
  }
  const todos = useTodos.getState();
  for (const t of todos.todos) if (toKompa(t.title) !== t.title) todos.update(t.id, { title: toKompa(t.title) });
  useSettings.getState().set({ renamedToKompa: true });
}
