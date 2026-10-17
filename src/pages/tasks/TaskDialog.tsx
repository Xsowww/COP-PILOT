import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { DateField, TimeField } from '../../components/Pickers';
import { Modal } from '../../components/Overlays';
import ReminderPicker from '../../components/ReminderPicker';
import { adaptReminders, reminderMoment } from '../../lib/reminders';
import { useTodos, type Todo } from '../../store/todos';
import { toast } from '../../store/ui';

/**
 * « Modifier la tâche » : its title, due day, optional time and reminders. Opened from the bell
 * (`remind`: a reminder is offered straight away) or from the pencil.
 */
export default function TaskDialog({ todo, onClose, remind, onDelete }: { todo: Todo; onClose: () => void; remind?: boolean; onDelete?: () => void }) {
  const [title, setTitle] = useState(todo.title);
  const [due, setDue] = useState(todo.due ?? '');
  const [time, setTime] = useState(todo.time ?? '');
  // A task without reminders yet: the evening before, or 15 min before when it has a time.
  // Not one already past (« la veille à 18h » of a task due today): the moment itself instead.
  const [reminders, setReminders] = useState<number[]>(() => {
    if (todo.reminders) return todo.reminders;
    if (!remind) return [];
    const first = todo.time ? 15 : 900;
    return !todo.due || reminderMoment(todo.due, todo.time, first).getTime() > Date.now() ? [first] : [0];
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    useTodos.getState().update(todo.id, { title: title.trim(), due: due || undefined, time: due && time ? time : undefined, reminders: due ? reminders : todo.reminders });
    toast(remind && due && reminders.length ? 'Rappel enregistré' : 'Tâche enregistrée', 'success');
    onClose();
  };

  return (
    <Modal open onClose={onClose} width={420}>
      <form onSubmit={submit}>
        <h3 className="text-[18px]">Modifier la tâche</h3>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12px] font-medium text-stone-600">Tâche</span>
          <input autoFocus={!remind} value={title} maxLength={160} onChange={e => setTitle(e.target.value)} aria-label="Titre de la tâche" className="field w-full" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-stone-600">Échéance</span>
            <DateField value={due} onChange={setDue} label="Échéance" clearable className="w-full" />
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-stone-600">Heure (facultatif)</span>
            <TimeField
              value={time}
              disabled={!due}
              clearable
              label="Heure de l’échéance"
              placeholder="Dans la journée"
              onChange={v => {
                if (!!v !== !!time) setReminders(r => adaptReminders(r, !!v, v ? [15] : [900]));
                setTime(v);
              }}
              className="w-full"
            />
          </div>
        </div>
        <ReminderPicker value={reminders} onChange={setReminders} timed={!!time} date={due || undefined} time={time || undefined} disabled={due ? undefined : 'Choisis d’abord une échéance.'} />
        <div className="mt-5 flex items-center justify-end gap-2">
          {onDelete && (
            <button type="button" className="btn-ghost mr-auto text-red-600 hover:text-red-700" onClick={() => (onClose(), onDelete())}>
              <Trash2 size={15} /> Supprimer
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={!title.trim()}>
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}
