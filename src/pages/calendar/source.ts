// Where the Calendar page reads and writes its events: my own calendar (the store), or a shared calendar
// (pages/groups/SharedCalendar), with the same screens — day, week, month, quick add, drag.

import { createContext, useContext, useMemo } from 'react';
import { useCalendar, type CalendarEvent, type NewEvent } from '../../store/calendar';
import { trashEvent } from '../../lib/trash';
import type { Group } from '../../lib/groups';

export interface CalendarSource {
  /** null: my calendar. A shared calendar has no « fait », reminders, import or custom categories. */
  shared: { group: Group; author: (eventId: string) => string; canEdit: boolean } | null;
  events: CalendarEvent[];
  add: (e: NewEvent) => void;
  update: (id: string, patch: Partial<CalendarEvent>) => void;
  toggleDone: (id: string) => void;
  remove: (id: string) => void;
}

export const CalendarSourceContext = createContext<CalendarSource | null>(null);

export function useCalendarSource(): CalendarSource {
  const shared = useContext(CalendarSourceContext);
  const events = useCalendar(s => s.events);
  const mine = useMemo<CalendarSource>(() => {
    const { add, update, toggleDone } = useCalendar.getState();
    return { shared: null, events, add: e => void add(e), update, toggleDone, remove: trashEvent };
  }, [events]);
  return shared ?? mine;
}
