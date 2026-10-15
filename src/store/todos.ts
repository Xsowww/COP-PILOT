import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, nowIso } from '../lib/utils';
import { userStorage } from '../lib/userStorage';

/** A simple to-do, independent from the calendar (« acheter une calculatrice »). */
export interface Todo {
  id: string;
  title: string;
  done: boolean;
  due?: string; // YYYY-MM-DD, optional
  createdAt: string;
  doneAt?: string;
}

interface TodosState {
  todos: Todo[];
  add: (title: string, due?: string) => Todo;
  update: (id: string, patch: Partial<Pick<Todo, 'title' | 'due'>>) => void;
  toggle: (id: string) => void;
  /** Returns the removed task, for « Annuler ». */
  remove: (id: string) => Todo | undefined;
  /** Returns the removed tasks, for « Annuler ». */
  clearDone: () => Todo[];
  /** Puts back removed tasks (undo). */
  restore: (todos: Todo[]) => void;
}

export const useTodos = create<TodosState>()(
  persist(
    (set, get) => ({
      todos: [],
      add(title, due) {
        const todo: Todo = { id: uid(), title: title.trim() || 'Tâche', done: false, due: due || undefined, createdAt: nowIso() };
        set(s => ({ todos: [...s.todos, todo] }));
        return todo;
      },
      update: (id, patch) => set(s => ({ todos: s.todos.map(t => (t.id === id ? { ...t, ...patch } : t)) })),
      toggle: id =>
        set(s => ({ todos: s.todos.map(t => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? undefined : nowIso() } : t)) })),
      remove(id) {
        const gone = get().todos.find(t => t.id === id);
        set(s => ({ todos: s.todos.filter(t => t.id !== id) }));
        return gone;
      },
      clearDone() {
        const gone = get().todos.filter(t => t.done);
        set(s => ({ todos: s.todos.filter(t => !t.done) }));
        return gone;
      },
      restore: back => set(s => ({ todos: [...s.todos, ...back.filter(b => !s.todos.some(t => t.id === b.id))] })),
    }),
    { name: 'todos', storage: userStorage, skipHydration: true },
  ),
);
