import { LayoutDashboard, FolderOpen, Calendar, FileText, Bot } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { AppView } from '../../types';

const NAV_ITEMS: { view: AppView; label: string; icon: React.ComponentType<{ size: number }> }[] = [
  { view: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { view: 'drive',     label: 'Drive',      icon: FolderOpen },
  { view: 'calendar',  label: 'Calendrier', icon: Calendar },
  { view: 'notes',     label: 'Notes',      icon: FileText },
];

export default function Sidebar() {
  const { view, setView } = useAppStore();

  return (
    <aside style={{
      width: 224,
      minWidth: 224,
      background: '#0e0e1a',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
    }}>

      {/* ── Logo ──────────────────────────────────── */}
      <div style={{ padding: '20px 16px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
        }}>
          <Bot size={17} color="white" />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            COP-PILOT
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', lineHeight: 1.3 }}>
            Hub étudiant
          </p>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 12px 10px' }} />

      {/* ── Navigation ────────────────────────────── */}
      <nav style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <p className="label-xs" style={{ padding: '2px 8px 8px' }}>Navigation</p>

        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = view === item.view;

          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 10px 9px 12px',
                borderRadius: 8,
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                outline: 'none',
                border: 'none',
                background: active ? 'rgba(99,102,241,0.13)' : 'transparent',
                color: active ? '#818cf8' : 'rgba(255,255,255,0.5)',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                borderLeft: active ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.78)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
                }
              }}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── User footer ───────────────────────────── */}
      <div style={{ padding: '8px 8px 12px' }}>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 4px 10px' }} />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 10px',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: 'white',
            flexShrink: 0,
          }}>É</div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3 }}>Étudiant</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', lineHeight: 1.3 }}>Plan Pro</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
