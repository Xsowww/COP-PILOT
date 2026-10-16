import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/Overlays';
import ReminderPicker from '../../components/ReminderPicker';
import { adaptReminders } from '../../lib/reminders';
import { useTodos, type Todo } from '../../store/todos';
import { toast } from '../../store/ui';

/** A task's due day, optional time and reminders (« me le rappeler la veille, 18 h »…). */
export default function TaskReminderDialog({ todo, onClose }: { todo: Todo; onClose: () => void }) {
  const [due, setDue] = useState(todo.due ?? '');
  const [time, setTime] = useState(todo.time ?? '');
  // A task without reminders yet: the evening before, or 15 min before when it has a time.
  const [reminders, setReminders] = useState<number[]>(todo.reminders ?? (todo.time ? [15] : [900]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    useTodos.getState().update(todo.id, { due: due || undefined, time: due && time ? time : undefined, reminders: due ? reminders : todo.reminders });
    toast(due && reminders.length ? 'Rappel enregistré' : 'Enregistré', 'success');
    onClose();
  };

  return (
    <Modal open onClose={onClose} width={420}>
      <form onSubmit={submit}>
        <h3 className="text-[15px] font-semibold">Rappel</h3>
        <p className="mt-1 line-clamp-2 text-[13px] text-stone-600 [overflow-wrap:anywhere]">{todo.title}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label>
            <span className="mb-1.5 block text-[12px] font-medium text-stone-600">Échéance</span>
            <input type="date" value={due} onChange={e => setDue(e.target.value)} className="field w-full" />
          </label>
          <label>
            <span className="mb-1.5 block text-[12px] font-medium text-stone-600">Heure (facultatif)</span>
            <input
              type="time"
              value={time}
              disabled={!due}
              onChange={e => {
                if (!!e.target.value !== !!time) setReminders(r => adaptReminders(r, !!e.target.value, e.target.value ? [15] : [900]));
                setTime(e.target.value);
              }}
              className="field w-full disabled:opacity-50"
            />
          </label>
        </div>
        <ReminderPicker value={reminders} onChange={setReminders} timed={!!time} date={due || undefined} time={time || undefined} disabled={due ? undefined : 'Choisis d’abord une échéance.'} />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-primary">
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}
