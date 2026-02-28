import { useState } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths,
  addWeeks, subWeeks, addDays, subDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, X, CalendarDays } from 'lucide-react';
import { useCalendarStore } from '../../store/calendarStore';
import type { CalendarEvent, EventPriority } from '../../types';
import { PRIORITY_COLORS } from '../../types';

type CalView = 'month' | 'week' | 'day';

const PRIORITY_LABELS: Record<EventPriority, string> = {
  low: 'Faible', medium: 'Moyen', high: 'Urgent', exam: 'Examen',
};

export default function CalendarSpace() {
  const { events, currentDate, view, setCurrentDate, setView, addEvent, deleteEvent, toggleDone } = useCalendarStore();
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', date: '',
    startTime: '', endTime: '', priority: 'medium' as EventPriority,
  });

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
      title: form.title, description: form.description, date: form.date,
      startTime: form.startTime || undefined, endTime: form.endTime || undefined,
      priority: form.priority, done: false, linkedFileIds: [], linkedNoteIds: [],
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Toolbar ──────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 24px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 30, height: 30, borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.09)',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.65)', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => navigate(1)}
            style={{
              width: 30, height: 30, borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.09)',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.65)', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Period label */}
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', textTransform: 'capitalize', flex: 1 }}>
          {viewLabel}
        </h2>

        {/* Today button */}
        <button
          onClick={() => setCurrentDate(new Date())}
          style={{
            padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
            background: 'rgba(99,102,241,0.12)', color: '#818cf8',
            border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
        >
          Aujourd'hui
        </button>

        {/* View switcher */}
        <div style={{
          display: 'flex', borderRadius: 8, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)',
        }}>
          {(['month', 'week', 'day'] as CalView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: 'none',
                background: view === v ? 'rgba(99,102,241,0.25)' : 'transparent',
                color: view === v ? '#818cf8' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.15s',
              }}
            >
              {v === 'month' ? 'Mois' : v === 'week' ? 'Semaine' : 'Jour'}
            </button>
          ))}
        </div>

        {/* Add event */}
        <button
          onClick={() => { setForm(f => ({ ...f, date: format(currentDate, 'yyyy-MM-dd') })); setShowForm(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
            background: '#6366f1', color: 'white', border: 'none',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#5254c7')}
          onMouseLeave={e => (e.currentTarget.style.background = '#6366f1')}
        >
          <Plus size={13} /> Événement
        </button>
      </div>

      {/* ── Calendar content ─────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {view === 'month' && (
          <MonthView
            currentDate={currentDate} events={events}
            onDayClick={handleDayClick} selectedDate={selectedDate}
            onToggle={toggleDone} onDelete={deleteEvent}
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate} events={events}
            onDayClick={handleDayClick} onToggle={toggleDone} onDelete={deleteEvent}
          />
        )}
        {view === 'day' && (
          <DayView
            currentDate={currentDate} events={events}
            onToggle={toggleDone} onDelete={deleteEvent}
          />
        )}
      </div>

      {/* ── Add event modal ───────────────────────────── */}
      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div
            className="animate-fadeIn"
            style={{
              width: '100%', maxWidth: 420, borderRadius: 16,
              background: '#14142a', border: '1px solid rgba(255,255,255,0.12)',
              padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={16} color="#818cf8" />
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>Nouvel événement</h3>
              </div>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Fields */}
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Titre de l'événement…"
              autoFocus
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#f1f5f9',
                outline: 'none', width: '100%',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optionnel)…"
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#f1f5f9',
                outline: 'none', width: '100%',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
            <input
              type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#f1f5f9',
                outline: 'none', width: '100%', colorScheme: 'dark',
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input
                type="time" value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#f1f5f9',
                  outline: 'none', colorScheme: 'dark',
                }}
              />
              <input
                type="time" value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#f1f5f9',
                  outline: 'none', colorScheme: 'dark',
                }}
              />
            </div>

            {/* Priority selector */}
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Priorité
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(Object.keys(PRIORITY_COLORS) as EventPriority[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setForm(f => ({ ...f, priority: p }))}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 11,
                      fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                      background: form.priority === p ? PRIORITY_COLORS[p] + '25' : 'rgba(255,255,255,0.05)',
                      border: `1.5px solid ${form.priority === p ? PRIORITY_COLORS[p] : 'rgba(255,255,255,0.09)'}`,
                      color: form.priority === p ? PRIORITY_COLORS[p] : 'rgba(255,255,255,0.45)',
                    }}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              style={{
                padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: '#6366f1', color: 'white', border: 'none',
                cursor: 'pointer', transition: 'background 0.15s', marginTop: 2,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#5254c7')}
              onMouseLeave={e => (e.currentTarget.style.background = '#6366f1')}
            >
              Créer l'événement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Month View ────────────────────────────────────────────────────────────────
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 600,
            color: 'rgba(255,255,255,0.3)', padding: '6px 0',
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
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
              style={{
                borderRadius: 10,
                padding: '8px 8px 6px',
                cursor: 'pointer',
                minHeight: 88,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                background: isSelected
                  ? 'rgba(99,102,241,0.15)'
                  : isToday
                  ? 'rgba(99,102,241,0.07)'
                  : 'rgba(255,255,255,0.025)',
                border: isSelected
                  ? '1.5px solid rgba(99,102,241,0.45)'
                  : isToday
                  ? '1.5px solid rgba(99,102,241,0.2)'
                  : '1px solid rgba(255,255,255,0.05)',
                opacity: isCurrentMonth ? 1 : 0.3,
                transition: 'background 0.12s, border-color 0.12s',
              }}
              onMouseEnter={e => {
                if (!isSelected && !isToday)
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={e => {
                if (!isSelected && !isToday)
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)';
              }}
            >
              {/* Day number */}
              <span style={{
                fontSize: 12,
                fontWeight: isToday ? 700 : 500,
                color: isToday ? '#818cf8' : 'rgba(255,255,255,0.75)',
                alignSelf: 'flex-end',
                lineHeight: 1,
              }}>
                {format(day, 'd')}
              </span>

              {/* Events */}
              {dayEvents.slice(0, 3).map(ev => (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '2px 5px', borderRadius: 4,
                    background: PRIORITY_COLORS[ev.priority] + '1e',
                  }}
                >
                  <div style={{
                    width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                    background: PRIORITY_COLORS[ev.priority],
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 500,
                    color: ev.done ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.82)',
                    textDecoration: ev.done ? 'line-through' : 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {ev.title}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); onToggle(ev.id); }}
                    title="Marquer fait"
                    style={{
                      marginLeft: 'auto', flexShrink: 0,
                      width: 12, height: 12, borderRadius: '50%',
                      border: 'none', background: 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  >
                    <Check size={8} color={PRIORITY_COLORS[ev.priority]} />
                  </button>
                </div>
              ))}
              {dayEvents.length > 3 && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', paddingLeft: 4 }}>
                  +{dayEvents.length - 3} autre{dayEvents.length - 3 > 1 ? 's' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ─────────────────────────────────────────────────────────────────
function WeekView({ currentDate, events, onDayClick, onToggle, onDelete }: {
  currentDate: Date; events: CalendarEvent[]; onDayClick: (d: string) => void;
  onToggle: (id: string) => void; onDelete: (id: string) => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, height: '100%' }}>
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayEvents = events.filter(e => e.date === dateStr);
        const isToday = isSameDay(day, new Date());

        return (
          <div key={dateStr} onClick={() => onDayClick(dateStr)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Day header */}
            <div style={{ textAlign: 'center', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                {format(day, 'EEE', { locale: fr })}
              </p>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: isToday ? '#6366f1' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '4px auto 0',
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? 'white' : 'rgba(255,255,255,0.75)' }}>
                  {format(day, 'd')}
                </span>
              </div>
            </div>

            {/* Events */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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

// ── Day View ──────────────────────────────────────────────────────────────────
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
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {dayEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <CalendarDays size={36} color="rgba(255,255,255,0.1)" />
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>Aucun événement ce jour</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>Cliquez sur "+ Événement" pour en ajouter un</p>
        </div>
      ) : (
        dayEvents.map(ev => (
          <div key={ev.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            {/* Time */}
            {ev.startTime && (
              <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 52 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: PRIORITY_COLORS[ev.priority], fontVariantNumeric: 'tabular-nums' }}>
                  {ev.startTime}
                </p>
                {ev.endTime && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>
                    {ev.endTime}
                  </p>
                )}
              </div>
            )}

            {/* Color bar */}
            <div style={{
              width: 3, alignSelf: 'stretch', borderRadius: 4, flexShrink: 0,
              background: PRIORITY_COLORS[ev.priority],
            }} />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 14, fontWeight: 600, color: '#f1f5f9',
                textDecoration: ev.done ? 'line-through' : 'none',
                opacity: ev.done ? 0.5 : 1,
              }}>
                {ev.title}
              </p>
              {ev.description && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4, lineHeight: 1.5 }}>
                  {ev.description}
                </p>
              )}
              <span style={{
                display: 'inline-block', marginTop: 6,
                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                background: PRIORITY_COLORS[ev.priority] + '22', color: PRIORITY_COLORS[ev.priority],
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {PRIORITY_LABELS[ev.priority]}
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => onToggle(ev.id)}
                title={ev.done ? 'Marquer non fait' : 'Marquer fait'}
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: ev.done ? PRIORITY_COLORS[ev.priority] + '25' : 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Check size={13} color={ev.done ? PRIORITY_COLORS[ev.priority] : 'rgba(255,255,255,0.45)'} />
              </button>
              <button
                onClick={() => onDelete(ev.id)}
                title="Supprimer"
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  border: 'none', cursor: 'pointer',
                  background: 'rgba(239,68,68,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={13} color="#ef4444" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Event Chip (week view) ────────────────────────────────────────────────────
function EventChip({ event, onToggle, onDelete }: {
  event: CalendarEvent; onToggle: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = PRIORITY_COLORS[event.priority];

  return (
    <div
      style={{
        borderRadius: 6, padding: '5px 7px',
        background: color + '1c', border: `1px solid ${color}35`,
        display: 'flex', alignItems: 'center', gap: 5, position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <p style={{
        fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: event.done ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)',
        textDecoration: event.done ? 'line-through' : 'none',
      }}>
        {event.title}
      </p>
      {hovered && (
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={e => { e.stopPropagation(); onToggle(event.id); }}
            style={{
              width: 16, height: 16, borderRadius: 4,
              border: 'none', cursor: 'pointer',
              background: color + '35',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Check size={9} color={color} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(event.id); }}
            style={{
              width: 16, height: 16, borderRadius: 4,
              border: 'none', cursor: 'pointer',
              background: 'rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Trash2 size={9} color="#ef4444" />
          </button>
        </div>
      )}
    </div>
  );
}
