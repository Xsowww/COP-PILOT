import { create } from 'zustand';
import { useTodos } from './todos';

/** Title of the starter task that launches the tour (TodoList shows a « Lancer » button on it). */
export const TOUR_TODO = 'Faire le tour de Kompaly (1 min)';
/** Accounts created before the app became Kompaly still have the task under its old title. */
export const isTourTodo = (title: string) => title === TOUR_TODO || title === 'Faire le tour de Kompa (1 min)';

/** Current step of the guided tour (components/Tour), null when it isn't running. */
export const useTour = create<{ step: number | null }>(() => ({ step: null }));

export function startTour() {
  useTour.setState({ step: 0 });
}

/** End of the tour, finished or skipped: the starter task is ticked off. */
export function endTour() {
  useTour.setState({ step: null });
  const todos = useTodos.getState();
  const t = todos.todos.find(x => isTourTodo(x.title) && !x.done);
  if (t) todos.toggle(t.id);
}
