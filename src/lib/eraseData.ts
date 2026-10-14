import { useDrive } from '../store/drive';
import { useNotes } from '../store/notes';
import { useCalendar } from '../store/calendar';
import { useTodos } from '../store/todos';
import { useFocusLog } from '../store/focusLog';
import { useCopilot } from '../store/copilot';
import { blobStore } from './blobStore';
import { blobKey, trashBlobKey } from './userStorage';

/**
 * Empties the account (files and their contents, notes, events, tasks, focus history, conversation, trash
 * included) but keeps the account itself, its profile and its settings. Groups are shared: left as they are.
 * The cloud copy follows through the usual sync, which deletes the rows that disappeared.
 */
export async function eraseMyData() {
  const { items, trash } = useDrive.getState();
  const files = [...items, ...trash].filter(i => i.kind === 'file');
  await Promise.allSettled(files.flatMap(f => [blobStore.delete(blobKey(f.id)), blobStore.delete(trashBlobKey(f.id))]));
  useDrive.setState({ items: [], trash: [], clipboard: null });
  useNotes.setState({ folders: [], notes: [], trashFolders: [], trashNotes: [] });
  useCalendar.setState({ events: [], trash: [] });
  useTodos.setState({ todos: [] });
  useFocusLog.setState({ sessions: [] });
  useCopilot.getState().clearHistory();
  useCopilot.setState({ memory: {} });
  void import('./textIndex').then(m => m.forgetTextIndex()).catch(() => undefined);
}
