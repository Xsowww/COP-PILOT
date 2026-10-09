import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../../components/Overlays';
import { CATEGORIES, guessCategory, useCalendar, type CalendarEvent, type EventCategory } from '../../store/calendar';
import { cx } from '../../lib/utils';

interface Props {
  event?: CalendarEvent;
  date: string;
  onClose: () => void;
}

export default function EventForm({ event, date, onClose }: Props) {
  const { add, update, remove } = useCalendar.getState();
  const [title, setTitle] = useState(event?.title ?? '');
  const [day, setDay] = useState(event?.date ?? date);
  const [start, setStart] = useState(event?.start ?? '');
  const [end, setEnd] = useState(event?.end ?? '');
  const [category, setCategory] = useState<EventCategory | null>(event?.category ?? null);
  const [details, setDetails] = useState(event?.details ?? '');
  const effective = category ?? guessCategory(title);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !day) return;
    const data = { title: title.trim(), date: day, start: start || undefined, end: end || undefined, category: effective, details: details.trim() || undefined };
    if (event) update(event.id, data);
    else add(data);
    onClose();
  };

  return (
    <Modal open onClose={onClose} width={460}>
      <form onSubmit={submit}>
        <h3 className="text-lg font-semibold">{event ? "Modifier l'événement" : 'Nouvel événement'}</h3>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Quoi ? (ex : Partiel de maths)" className="field mt-4 w-full text-base" />

        <p className="mb-2 mt-4 text-xs font-medium text-slate-500">Type</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORIES) as EventCategory[]).map(k => {
            const c = CATEGORIES[k];
            const active = effective === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setCategory(k)}
                className={cx('rounded-full border-2 px-3 py-1.5 text-sm font-medium transition', active ? 'shadow-sm' : 'border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100')}
                style={active ? { borderColor: c.color, background: c.soft, color: c.text } : undefined}
              >
                {c.emoji} {c.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <label className="col-span-3 sm:col-span-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Jour</span>
            <input type="date" value={day} onChange={e => setDay(e.target.value)} className="field w-full" required />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Début</span>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} className="field w-full" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Fin</span>
            <input type="time" value={end} min={start} onChange={e => setEnd(e.target.value)} className="field w-full" />
          </label>
        </div>

        <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Notes (salle, chapitres à réviser…)" rows={3} className="field mt-3 w-full resize-none" />

        <div className="mt-5 flex items-center gap-2">
          {event && (
            <button
              type="button"
              className="btn-ghost text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onClick={() => {
                remove(event.id);
                onClose();
              }}
            >
              <Trash2 size={15} /> Supprimer
            </button>
          )}
          <button type="button" className="btn-ghost ml-auto" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={!title.trim()}>
            {event ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
