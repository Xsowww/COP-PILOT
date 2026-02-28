import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, X } from 'lucide-react';
import { useCalendarStore } from '../../store/calendarStore';
import type { CalendarEvent, EventPriority } from '../../types';
import { PRIORITY_COLORS } from '../../types';

type CalView = 'month' | 'week' | 'day';

export default function CalendarSpace() {
  const { events, currentDate, view, setCurrentDate, setView, addEvent, deleteEvent, toggleDone } = useCalendarStore();
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', date: '', startTime: '', endTime: '', priority: 'medium' as EventPriority });

  const navigate = (dir: 1 | -1) => {
    if (view === 'month') setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(dir === 1 ? addDays(currentDate, 1) : subDays(currentDate, 1));
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setForm(f => ({ ...f, date: dateStr }));
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.date) return;
    addEvent({
      title: form.title,
      description: form.description,
      date: form.date,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      priority: form.priority,
      done: false,
      linkedFileIds: [],
      linkedNoteIds: [],
    });
    setForm({ title: '', description: '', date: '', startTime: '', endTime: '', priority: 'medium' });
    setShowForm(false);
  };

  const viewLabel = view === 'month'
    ? format(currentDate, 'MMMM yyyy', { locale: fr })
    : view === 'week'
    ? `Semaine du ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: fr })}`
    : format(currentDate, 'EEEE d MMMM yyyy', { locale: fr });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 flex-1">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <ChevronLeft size={15} color="rgba(255,255,255,0.7)" />
          </button>
          <button onClick={() => navigate(1)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <ChevronRight size={15} color="rgba(255,255,255,0.7)" />
          </button>
          <h2 className="text-sm font-semibold text-white capitalize ml-1">{viewLabel}</h2>
          <button onClick={() => setCurrentDate(new Date())} className="px-2.5 py-1 rounded-lg text-xs ml-1" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
            Aujourd'hui
          </button>
        </div>
        <div className="flex items-center gap-1">
          {(['month', 'week', 'day'] as CalView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={view === v
                ? { background: 'rgba(99,102,241,0.25)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.35)' }
                : { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }
              }
            >
              {v === 'month' ? 'Mois' : v === 'week' ? 'Semaine' : 'Jour'}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setForm(f => ({ ...f, date: format(currentDate, 'yyyy-MM-dd') })); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
        >
          <Plus size={13} /> Événement
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-2 shrink-0">
        {Object.entries(PRIORITY_COLORS).map(([p, c]) => (
          <div key={p} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: c }} />
            <span className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.45)' }}>{p}</span>
          </div>
        ))}
      </div>

      {/* Calendar View */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {view === 'month' && <MonthView currentDate={currentDate} events={events} onDayClick={handleDayClick} selectedDate={selectedDate} onToggle={toggleDone} onDelete={deleteEvent} />}
        {view === 'week' && <WeekView currentDate={currentDate} events={events} onDayClick={handleDayClick} onToggle={toggleDone} onDelete={deleteEvent} />}
        {view === 'day' && <DayView currentDate={currentDate} events={events} onToggle={toggleDone} onDelete={deleteEvent} />}
      </div>

      {/* New event form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="animate-fadeIn rounded-2xl w-full max-w-md p-6 flex flex-col gap-4"
            style={{ background: 'rgba(18,18,32,0.97)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(40px)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Nouvel événement</h3>
              <button onClick={() => setShowForm(false)}><X size={16} color="rgba(255,255,255,0.5)" /></button>
            </div>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre…" autoFocus
              className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optionnel)…"
              className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', colorScheme: 'dark' }} />
            <div className="grid grid-cols-2 gap-2">
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} placeholder="Début"
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', colorScheme: 'dark' }} />
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} placeholder="Fin"
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', colorScheme: 'dark' }} />
            </div>
            <div className="flex gap-2">
              {(Object.keys(PRIORITY_COLORS) as EventPriority[]).map(p => (
                <button key={p}
                  onClick={() => setForm(f => ({ ...f, priority: p }))}
                  className="flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{
                    background: form.priority === p ? PRIORITY_COLORS[p] + '30' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${form.priority === p ? PRIORITY_COLORS[p] : 'rgba(255,255,255,0.1)'}`,
                    color: form.priority === p ? PRIORITY_COLORS[p] : 'rgba(255,255,255,0.5)',
                  }}
                >{p}</button>
              ))}
            </div>
            <button onClick={handleSubmit}
              className="py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
              Créer l'événement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Month View ─────────────────────────────────────────────────────────────
function MonthView({ currentDate, events, onDayClick, selectedDate, onToggle }: {
  currentDate: Date; events: CalendarEvent[]; onDayClick: (d: string) => void;
  selectedDate: string | null; onToggle: (id: string) => void; onDelete?: (id: string) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const start = startOfWeek(monthStart, { weekStartsOn: 1 });
  const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs py-2 font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayEvents = events.filter(e => e.date === dateStr);
          const isToday = isSameDay(day, new Date());
          const isSelected = dateStr === selectedDate;
          const isCurrentMonth = isSameMonth(day, currentDate);

          return (
            <div
              key={dateStr}
              onClick={() => onDayClick(dateStr)}
              className="rounded-xl p-2 cursor-pointer transition-all min-h-20 flex flex-col gap-1"
              style={{
                background: isSelected ? 'rgba(99,102,241,0.2)' : isToday ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                border: isSelected ? '1px solid rgba(99,102,241,0.5)' : isToday ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.04)',
                opacity: isCurrentMonth ? 1 : 0.35,
              }}
            >
              <span className="text-xs font-semibold" style={{ color: isToday ? '#818cf8' : 'rgba(255,255,255,0.8)' }}>
                {format(day, 'd')}
              </span>
              {dayEvents.slice(0, 3).map(ev => (
                <div key={ev.id} className="rounded-md px-1.5 py-0.5 flex items-center gap-1 group relative" style={{ background: PRIORITY_COLORS[ev.priority] + '22' }}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PRIORITY_COLORS[ev.priority] }} />
                  <span className="text-xs truncate" style={{ color: ev.done ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)', textDecoration: ev.done ? 'line-through' : 'none', fontSize: '10px' }}>
                    {ev.title}
                  </span>
                  <button onClick={e => { e.stopPropagation(); onToggle(ev.id); }} className="hidden group-hover:flex w-3 h-3 rounded-full items-center justify-center shrink-0" style={{ background: PRIORITY_COLORS[ev.priority] }}>
                    <Check size={8} color="white" />
                  </button>
                </div>
              ))}
              {dayEvents.length > 3 && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>+{dayEvents.length - 3}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ──────────────────────────────────────────────────────────────
function WeekView({ currentDate, events, onDayClick, onToggle, onDelete }: {
  currentDate: Date; events: CalendarEvent[]; onDayClick: (d: string) => void;
  onToggle: (id: string) => void; onDelete: (id: string) => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="grid grid-cols-7 gap-3">
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayEvents = events.filter(e => e.date === dateStr);
        const isToday = isSameDay(day, new Date());

        return (
          <div key={dateStr} onClick={() => onDayClick(dateStr)} className="flex flex-col gap-2 cursor-pointer">
            <div className="text-center">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{format(day, 'EEE', { locale: fr })}</p>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mt-1 text-sm font-semibold"
                style={{ background: isToday ? '#6366f1' : 'transparent', color: isToday ? 'white' : 'rgba(255,255,255,0.8)' }}
              >
                {format(day, 'd')}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 min-h-48">
              {dayEvents.map(ev => (
                <EventChip key={ev.id} event={ev} onToggle={onToggle} onDelete={onDelete} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Day View ───────────────────────────────────────────────────────────────
function DayView({ currentDate, events, onToggle, onDelete }: {
  currentDate: Date; events: CalendarEvent[];
  onToggle: (id: string) => void; onDelete: (id: string) => void;
}) {
  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const dayEvents = events.filter(e => e.date === dateStr).sort((a, b) => {
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return a.startTime.localeCompare(b.startTime);
  });

  return (
    <div className="flex flex-col gap-3 max-w-xl">
      {dayEvents.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucun événement ce jour</p>
      ) : (
        dayEvents.map(ev => (
          <div key={ev.id} className="glass-card p-4 flex items-start gap-4">
            {ev.startTime && (
              <div className="text-xs font-mono shrink-0 mt-0.5" style={{ color: PRIORITY_COLORS[ev.priority] }}>
                {ev.startTime}{ev.endTime ? `\n${ev.endTime}` : ''}
              </div>
            )}
            <div
              className="w-0.5 self-stretch rounded-full shrink-0"
              style={{ background: PRIORITY_COLORS[ev.priority] }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white" style={{ textDecoration: ev.done ? 'line-through' : 'none', opacity: ev.done ? 0.5 : 1 }}>{ev.title}</p>
              {ev.description && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{ev.description}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => onToggle(ev.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: ev.done ? PRIORITY_COLORS[ev.priority] + '30' : 'rgba(255,255,255,0.06)' }}>
                <Check size={13} color={ev.done ? PRIORITY_COLORS[ev.priority] : 'rgba(255,255,255,0.4)'} />
              </button>
              <button onClick={() => onDelete(ev.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <Trash2 size={13} color="#ef4444" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function EventChip({ event, onToggle, onDelete }: { event: CalendarEvent; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="rounded-lg px-2 py-1.5 flex items-center gap-1.5 relative group"
      style={{ background: PRIORITY_COLORS[event.priority] + '20', border: `1px solid ${PRIORITY_COLORS[event.priority]}40` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PRIORITY_COLORS[event.priority] }} />
      <p className="text-xs flex-1 truncate" style={{ color: event.done ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)', textDecoration: event.done ? 'line-through' : 'none', fontSize: '11px' }}>
        {event.title}
      </p>
      {hovered && (
        <div className="flex gap-0.5">
          <button onClick={e => { e.stopPropagation(); onToggle(event.id); }} className="w-4 h-4 rounded flex items-center justify-center" style={{ background: PRIORITY_COLORS[event.priority] + '40' }}>
            <Check size={9} color={PRIORITY_COLORS[event.priority]} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(event.id); }} className="w-4 h-4 rounded flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.3)' }}>
            <Trash2 size={9} color="#ef4444" />
          </button>
        </div>
      )}
    </div>
  );
}
