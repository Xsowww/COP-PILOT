// « Ma semaine » on the home page: what is planned this week and how much of it is done.

import type { Todo } from '../store/todos';
import { isDeliverable, type CalendarEvent } from '../store/calendar';

/**
 * What counts for « ma semaine »: the tasks due this week (or ticked this week), and the homework of
 * the calendar due this week. Ticking one fills the ring.
 */
export function weekItems(todos: Todo[], events: CalendarEvent[], from: string, to: string) {
  const inWeek = (key?: string) => !!key && key >= from && key <= to;
  const tasks = todos.filter(t => inWeek(t.due) || (t.done && inWeek(t.doneAt?.slice(0, 10))));
  const homework = events.filter(e => isDeliverable(e) && inWeek(e.date));
  const total = tasks.length + homework.length;
  const done = tasks.filter(t => t.done).length + homework.filter(e => e.done).length;
  return { total, done };
}

/** A sentence that pulls toward the next tick. */
export function cheer(done: number, total: number): string {
  if (!total) return 'Rien à faire cette semaine. Donne une échéance à une tâche pour la suivre ici.';
  const left = total - done;
  if (!left) return 'Semaine bouclée, bravo !';
  if (!done) return `C’est parti : ${total === 1 ? 'une chose' : `${total} choses`} à faire cette semaine.`;
  const toHalf = Math.ceil(total / 2) - done;
  if (toHalf > 0 && left > 1) return `Plus que ${toHalf} pour passer la moitié.`;
  return left === 1 ? 'Plus qu’une, tu y es presque !' : `Plus que ${left}, tu y es presque.`;
}
