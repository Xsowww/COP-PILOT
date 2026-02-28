import { Bell, Settings } from 'lucide-react';
import SearchBar from './SearchBar';
import { useAppStore } from '../../store/appStore';
import { useCopStore } from '../../store/copStore';

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  drive: 'Drive',
  calendar: 'Calendrier',
  notes: 'Notes',
};

export default function TopBar() {
  const { view } = useAppStore();
  const { suggestions } = useCopStore();

  return (
    <header
      className="flex items-center gap-4 px-6 py-3 shrink-0"
      style={{
        background: 'rgba(15,15,26,0.6)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <h1 className="text-base font-semibold text-white/80 shrink-0">{VIEW_TITLES[view]}</h1>
      <SearchBar />
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <button
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Bell size={16} color="rgba(255,255,255,0.6)" />
          </button>
          {suggestions.length > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: '#6366f1', fontSize: '10px' }}
            >
              {suggestions.length}
            </span>
          )}
        </div>
        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Settings size={16} color="rgba(255,255,255,0.6)" />
        </button>
      </div>
    </header>
  );
}
