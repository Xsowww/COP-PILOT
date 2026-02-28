import { LayoutDashboard, FolderOpen, Calendar, FileText, Bot } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { AppView } from '../../types';

const NAV_ITEMS: { view: AppView; label: string; icon: React.ReactNode }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { view: 'drive', label: 'Drive', icon: <FolderOpen size={20} /> },
  { view: 'calendar', label: 'Calendrier', icon: <Calendar size={20} /> },
  { view: 'notes', label: 'Notes', icon: <FileText size={20} /> },
];

export default function Sidebar() {
  const { view, setView } = useAppStore();

  return (
    <aside
      className="glass flex flex-col w-16 hover:w-52 transition-all duration-300 overflow-hidden shrink-0 z-10"
      style={{
        background: 'rgba(15,15,26,0.7)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
        >
          <Bot size={16} color="white" />
        </div>
        <span
          className="text-sm font-bold whitespace-nowrap overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          COP-PILOT
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 12px' }} />

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV_ITEMS.map(item => {
          const active = view === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left w-full"
              style={{
                background: active ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: active ? '#818cf8' : 'rgba(255,255,255,0.55)',
                border: active ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="text-sm font-medium whitespace-nowrap overflow-hidden">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 shrink-0">
        <div
          className="rounded-xl p-3 flex items-center gap-3 overflow-hidden"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <div
            className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
          >
            E
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-medium text-white truncate">Étudiant</p>
            <p className="text-xs text-white/40 truncate">Pro Plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
