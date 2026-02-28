import { Calendar, ArrowRight, Check } from 'lucide-react';
import { useCalendarStore } from '../../store/calendarStore';
import { useAppStore } from '../../store/appStore';
import type { CalendarEvent } from '../../types';
import { PRIORITY_COLORS } from '../../types';

function EventRow({ event }: { event: CalendarEvent }) {
  const { toggleDone } = useCalendarStore();
  const color = PRIORITY_COLORS[event.priority];

  return (
    <div className="flex items-center gap-3 p-2 rounded-xl transition-colors"
      style={{ background: 'rgba(255,255,255,0.03)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
    >
      <button
        onClick={() => toggleDone(event.id)}
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all border"
        style={{
          borderColor: event.done ? color : 'rgba(255,255,255,0.2)',
          background: event.done ? color : 'transparent',
        }}
      >
        {event.done && <Check size={11} color="white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-medium truncate"
          style={{
            color: event.done ? 'rgba(255,255,255,0.35)' : 'white',
            textDecoration: event.done ? 'line-through' : 'none',
          }}
        >
          {event.title}
        </p>
        {event.startTime && (
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{event.startTime}</p>
        )}
      </div>
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: color }}
      />
    </div>
  );
}

export default function CalendarWidget() {
  const { getTodayEvents } = useCalendarStore();
  const { setView } = useAppStore();
  const todayEvents = getTodayEvents();

  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} color="#f59e0b" />
          <span className="text-sm font-semibold text-white">Aujourd'hui</span>
        </div>
        <button
          onClick={() => setView('calendar')}
          className="flex items-center gap-1 text-xs transition-opacity opacity-60 hover:opacity-100"
          style={{ color: '#f59e0b' }}
        >
          Calendrier <ArrowRight size={12} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {todayEvents.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Aucun événement aujourd'hui 🎉
          </p>
        ) : (
          todayEvents.map(e => <EventRow key={e.id} event={e} />)
        )}
      </div>

      {todayEvents.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(PRIORITY_COLORS).map(([p, c]) => (
            <div key={p} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
              <span className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.4)' }}>{p}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
