import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Check, ChevronRight, Trash2, X } from 'lucide-react';
import { useTodos, type Todo } from '../../store/todos';
import { countdownLabel, daysUntil, fmt, fromKey, todayKey } from '../../lib/dates';
import { cx } from '../../lib/utils';
import { isTourTodo, startTour } from '../../store/tour';

const OVERDUE = 'var(--cat-examen-text)';

const sortOpen = (a: Todo, b: Todo) =>
  (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt.localeCompare(b.createdAt);

function DueLabel({ due }: { due: string }) {
  const n = daysUntil(due);
  const label = n < 0 ? (n === -1 ? 'Hier' : `En retard · ${fmt(fromKey(due), 'd MMM')}`) : n > 6 ? fmt(fromKey(due), 'd MMM') : n > 1 ? fmt(fromKey(due), 'EEE d') : countdownLabel(due);
  return (
    <span className={cx('tabular shrink-0 text-[12px] first-letter:uppercase', n < 0 ? 'font-medium' : n === 0 ? 'text-ink' : 'text-stone-500')} style={n < 0 ? { color: OVERDUE } : undefined}>
      {label}
    </span>
  );
}

function TodoRow({ t, editable }: { t: Todo; editable?: boolean }) {
  const { toggle, remove, update } = useTodos();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.title);
  const overdue = !t.done && !!t.due && t.due < todayKey();

  const save = () => {
    setEditing(false);
    if (title.trim() && title.trim() !== t.title) update(t.id, { title: title.trim() });
    else setTitle(t.title);
  };

  return (
    <li className="group flex min-h-9 items-center gap-3 rounded-lg px-1.5 py-1 transition-colors hover:bg-stone-50">
      <button
        onClick={() => toggle(t.id)}
        className={cx(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors',
          t.done ? 'border-ink bg-ink' : overdue ? 'border-[#d9a19a] hover:border-[#b13428] dark:border-red-300 dark:hover:border-red-600' : 'border-stone-300 hover:border-stone-500',
        )}
        title={t.done ? 'Remettre à faire' : 'Marquer comme faite'}
        aria-label={t.done ? `Remettre « ${t.title} » à faire` : `Cocher « ${t.title} »`}
      >
        {t.done && <Check size={10} strokeWidth={3} className="text-paper" />}
      </button>
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setTitle(t.title);
              setEditing(false);
            }
          }}
          className="field h-7 min-w-0 flex-1 px-2"
        />
      ) : (
        <span
          onDoubleClick={() => editable && !t.done && setEditing(true)}
          className={cx('line-clamp-2 min-w-0 flex-1 break-words text-[13px]', t.done ? 'text-stone-500 line-through' : 'text-ink')}
          title={editable && !t.done ? 'Double-clic pour modifier' : t.title}
        >
          {t.title}
        </span>
      )}
      {isTourTodo(t.title) && !t.done && (
        <button type="button" onClick={startTour} className="btn-primary h-7 shrink-0 px-2.5 text-[12px]">
          Lancer
        </button>
      )}
      {!t.done && editable && (
        <label className="hidden shrink-0 sm:group-focus-within:block sm:group-hover:block" title="Échéance">
          <span className="sr-only">Échéance de « {t.title} »</span>
          <input
            type="date"
            value={t.due ?? ''}
            onChange={e => update(t.id, { due: e.target.value || undefined })}
            className="h-7 w-[124px] rounded-md border border-stone-200 bg-surface px-1.5 text-[12px] text-stone-600 outline-none focus:border-stone-400"
          />
        </label>
      )}
      {t.due && !t.done && (
        <span className={cx(editable && 'sm:group-focus-within:hidden sm:group-hover:hidden')}>
          <DueLabel due={t.due} />
        </span>
      )}
      {t.done && t.doneAt && <span className="tabular shrink-0 text-[11px] text-stone-500">{fmt(new Date(t.doneAt), 'd MMM')}</span>}
      <button onClick={() => remove(t.id)} className="icon-btn touch-show h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-600" title="Supprimer" aria-label={`Supprimer « ${t.title} »`}>
        <Trash2 size={13} />
      </button>
    </li>
  );
}

function QuickAdd() {
  const add = useTodos(s => s.add);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [showDate, setShowDate] = useState(false);

  const submit = () => {
    if (!title.trim()) return;
    add(title, due || undefined);
    setTitle('');
    setDue('');
    setShowDate(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="min-w-0 flex-1">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Ajouter une tâche…"
          aria-label="Nouvelle tâche"
          maxLength={160}
          className="field w-full"
        />
      </div>
      {showDate || due ? (
        <span className="flex shrink-0 items-center">
          <input
            type="date"
            value={due}
            autoFocus={!due}
            min={todayKey()}
            onChange={e => setDue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            aria-label="Échéance (facultative)"
            className="field w-[132px] px-2"
          />
          <button onClick={() => (setDue(''), setShowDate(false))} className="icon-btn" title="Sans échéance" aria-label="Sans échéance">
            <X size={14} />
          </button>
        </span>
      ) : (
        <button onClick={() => setShowDate(true)} className="icon-btn h-9 w-9" title="Ajouter une échéance" aria-label="Ajouter une échéance">
          <CalendarPlus size={15} />
        </button>
      )}
    </div>
  );
}

/** Simple to-do list, independent from the calendar. `limit` gives the compact dashboard version. */
export default function TodoList({ limit, grouped }: { limit?: number; grouped?: boolean }) {
  const todos = useTodos(s => s.todos);
  const clearDone = useTodos(s => s.clearDone);
  const [showDone, setShowDone] = useState(false);
  const open = todos.filter(t => !t.done).sort(sortOpen);
  const done = todos.filter(t => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  const shown = limit ? open.slice(0, limit) : open;
  const today = todayKey();

  const groups = grouped
    ? [
        { label: 'En retard', items: open.filter(t => t.due && t.due < today) },
        { label: "Aujourd'hui", items: open.filter(t => t.due === today) },
        { label: 'À venir', items: open.filter(t => t.due && t.due > today) },
        { label: 'Sans échéance', items: open.filter(t => !t.due) },
      ].filter(g => g.items.length)
    : [{ label: '', items: shown }];

  return (
    <div className="flex flex-1 flex-col">
      <QuickAdd />
      {open.length === 0 ? (
        <p className="py-5 text-[13px] text-stone-500">{done.length ? 'Tout est coché. Profites-en.' : 'Rien à faire pour l’instant.'}</p>
      ) : (
        <div className="mt-2">
          {groups.map(g => (
            <div key={g.label} className={cx(g.label && 'mt-3 first:mt-1')}>
              {g.label && (
                <h3 className="eyebrow mb-0.5 px-1.5" style={g.label === 'En retard' ? { color: OVERDUE } : undefined}>
                  {g.label}
                </h3>
              )}
              <ul className="-mx-1.5">
                {g.items.map(t => (
                  <TodoRow key={t.id} t={t} editable={grouped} />
                ))}
              </ul>
            </div>
          ))}
          {limit && open.length > limit && (
            <Link to="/taches" className="mt-1 inline-flex items-center gap-0.5 px-0.5 text-[12px] text-stone-500 hover:text-ink">
              {open.length - limit} autre{open.length - limit > 1 ? 's' : ''} <ChevronRight size={13} />
            </Link>
          )}
        </div>
      )}
      {done.length > 0 && (
        <div className="mt-auto border-t border-stone-100 pt-2">
          <div className="flex items-center">
            <button onClick={() => setShowDone(v => !v)} className="flex items-center gap-1 rounded px-0.5 text-[12px] text-stone-500 hover:text-ink" aria-expanded={showDone}>
              <ChevronRight size={13} className={cx('transition-transform', showDone && 'rotate-90')} />
              Terminées <span className="tabular text-stone-500">{done.length}</span>
            </button>
            <button onClick={clearDone} className="ml-auto rounded px-1 text-[12px] text-stone-500 hover:text-ink">
              Effacer les terminées
            </button>
          </div>
          {showDone && (
            <ul className="-mx-1.5 mt-1">
              {(limit ? done.slice(0, limit) : done).map(t => (
                <TodoRow key={t.id} t={t} editable={grouped} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
