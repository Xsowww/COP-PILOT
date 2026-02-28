import { Bell, Settings } from 'lucide-react';
import SearchBar from './SearchBar';
import { useAppStore } from '../../store/appStore';
import { useCopStore } from '../../store/copStore';

const VIEW_META: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard',  subtitle: "Vue d'ensemble de votre espace" },
  drive:     { title: 'Drive',      subtitle: 'Vos fichiers et dossiers' },
  calendar:  { title: 'Calendrier', subtitle: 'Planification et événements' },
  notes:     { title: 'Notes',      subtitle: 'Vos prises de notes' },
};

export default function TopBar() {
  const { view } = useAppStore();
  const { suggestions } = useCopStore();
  const meta = VIEW_META[view] ?? VIEW_META.dashboard;

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '0 24px',
      height: 56,
      background: '#111120',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      flexShrink: 0,
    }}>

      {/* Page title */}
      <div style={{ flexShrink: 0 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>
          {meta.title}
        </h1>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.2 }}>
          {meta.subtitle}
        </p>
      </div>

      <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 380 }}>
        <SearchBar />
      </div>

      <div style={{ flex: 1 }} />

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <button
            title="Suggestions COP"
            style={{
              width: 34, height: 34, borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.55)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            <Bell size={15} />
          </button>
          {suggestions.length > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              width: 16, height: 16, borderRadius: '50%',
              background: '#6366f1', fontSize: 10, fontWeight: 700,
              color: 'white', display: 'flex', alignItems: 'center',
              justifyContent: 'center', border: '2px solid #111120',
            }}>
              {suggestions.length}
            </span>
          )}
        </div>

        <button
          title="Paramètres"
          style={{
            width: 34, height: 34, borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'rgba(255,255,255,0.55)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
}
