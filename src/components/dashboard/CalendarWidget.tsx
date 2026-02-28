import { Calendar, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useCalendarStore } from '../../store/calendarStore';
import { useAppStore } from '../../store/appStore';
import type { CalendarEvent } from '../../types';
import { PRIORITY_COLORS } from '../../types';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Urgent',
  exam: 'Examen',
};

function EventRow({ event }: { event: CalendarEvent }) {
  const { toggleDone } = useCalendarStore();
  const color = PRIORITY_COLORS[event.priority];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        cursor: 'default',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Priority dot */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0, marginTop: 1,
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, fontWeight: 500, color: event.done ? 'rgba(255,255,255,0.3)' : '#f1f5f9',
          textDecoration: event.done ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {event.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {event.startTime && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontVariantNumeric: 'tabular-nums' }}>
              {event.startTime}{event.endTime ? ` → ${event.endTime}` : ''}
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 5px',
            borderRadius: 4, background: color + '20', color: color,
            letterSpacing: '0.02em', textTransform: 'uppercase',
          }}>
            {PRIORITY_LABELS[event.priority] ?? event.priority}
          </span>
        </div>
      </div>

      {/* Toggle done */}
      <button
        onClick={() => toggleDone(event.id)}
        title="Marquer comme fait"
        style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          border: `1.5px solid ${event.done ? color : 'rgba(255,255,255,0.2)'}`,
          background: event.done ? color : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {event.done && <Check size={11} color="white" />}
      </button>
    </div>
  );
}

export default function CalendarWidget() {
  const { getTodayEvents } = useCalendarStore();
  const { setView } = useAppStore();
  const todayEvents = getTodayEvents();

  return (
    <div className="card" style={{ padding: '18px 0', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={14} color="#f59e0b" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Agenda du jour</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              {todayEvents.length === 0 ? 'Journée libre' : `${todayEvents.length} événement${todayEvents.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setView('calendar')}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: '#f59e0b', background: 'none',
            border: 'none', cursor: 'pointer', opacity: 0.7,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
        >
          Voir tout <ArrowRight size={11} />
        </button>
      </div>

      {/* Events list */}
      <div style={{ padding: '8px 8px 4px', flex: 1 }}>
        {todayEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Sparkles size={20} color="rgba(255,255,255,0.15)" />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Aucun événement aujourd'hui</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Profitez de votre temps libre</p>
          </div>
        ) : (
          todayEvents.map(e => <EventRow key={e.id} event={e} />)
        )}
      </div>
    </div>
  );
}
