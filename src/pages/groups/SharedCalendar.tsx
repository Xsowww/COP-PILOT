import { useMemo } from 'react';
import CalendarPage from '../calendar/CalendarPage';
import { CalendarSourceContext, type CalendarSource } from '../calendar/source';
import { CATEGORIES, type CalendarEvent, type EventCategory } from '../../store/calendar';
import { useGroups } from '../../store/groups';
import { toast } from '../../store/ui';
import { createEvent, deleteEvent, groupError, updateEvent, type Group, type GroupEvent, type NewGroupEvent } from '../../lib/groups';
import { useMemberName } from './util';

const builtin = (c: string | null | undefined): EventCategory => (c && c in CATEGORIES ? (c as EventCategory) : 'perso');

/** A shared calendar's event as the Calendar page shows it (its place, from the former list, joins the notes). */
const toCalendar = (e: GroupEvent): CalendarEvent => ({
  id: e.id,
  title: e.title,
  date: e.date,
  start: e.start ?? undefined,
  end: e.end ?? undefined,
  category: builtin(e.category),
  details: [e.place, e.details].filter(Boolean).join('\n') || undefined,
  done: false,
  createdAt: e.createdAt,
});

const toRow = (p: Partial<CalendarEvent>): Partial<NewGroupEvent> => ({
  ...(p.title !== undefined && { title: p.title }),
  ...(p.date !== undefined && { date: p.date }),
  ...('start' in p && { start: p.start ?? null }),
  ...('end' in p && { end: p.end ?? null }),
  ...(p.category !== undefined && { category: builtin(p.category) }),
  // The notes now hold the place too: it isn't kept twice.
  ...('details' in p && { details: p.details ?? null, place: null }),
});

/** The Calendar page (day, week, month…) on a shared calendar: every member sees the changes live. */
export default function SharedCalendar({ group }: { group: Group }) {
  const raw = useGroups(s => s.events[group.id]);
  const nameOf = useMemberName(group.id);

  const source = useMemo<CalendarSource>(() => {
    const list = raw ?? [];
    const reload = () => useGroups.getState().refresh(group.id, ['events']);
    // Shown at once; the server's answer (and the other members' changes) follow by Realtime.
    const patchLocal = (fn: (l: GroupEvent[]) => GroupEvent[]) => useGroups.setState(s => ({ events: { ...s.events, [group.id]: fn(s.events[group.id] ?? []) } }));
    const fail = (e: unknown) => {
      toast(groupError(e), 'error');
      void reload();
    };
    return {
      shared: { group, author: id => nameOf(list.find(e => e.id === id)?.createdBy ?? null) },
      events: list.map(toCalendar),
      add: e => {
        void createEvent(group.id, { title: e.title, date: e.date, start: e.start ?? null, end: e.end ?? null, place: null, category: builtin(e.category), details: e.details ?? null })
          .then(reload)
          .catch(fail);
      },
      update: (id, patch) => {
        const row = toRow(patch);
        patchLocal(l => l.map(e => (e.id === id ? { ...e, ...row } : e)));
        void updateEvent(id, row).catch(fail);
      },
      toggleDone: () => undefined, // no « fait » in a shared calendar
      remove: id => {
        const ev = list.find(e => e.id === id);
        patchLocal(l => l.filter(e => e.id !== id));
        void deleteEvent(id)
          .then(() =>
            toast('Supprimé de l’agenda', 'info', ev && {
              label: 'Annuler',
              run: () => void createEvent(group.id, { title: ev.title, date: ev.date, start: ev.start, end: ev.end, place: ev.place, category: ev.category, details: ev.details }).then(reload).catch(fail),
            }),
          )
          .catch(fail);
      },
    };
  }, [raw, group, nameOf]);

  return (
    <CalendarSourceContext.Provider value={source}>
      <CalendarPage />
    </CalendarSourceContext.Provider>
  );
}
