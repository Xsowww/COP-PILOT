import { useState, useEffect, useRef } from 'react';
import { Search, FileText, Calendar, FolderOpen, X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useDriveStore } from '../../store/driveStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useNotesStore } from '../../store/notesStore';
import type { SearchResult } from '../../types';

export default function SearchBar() {
  const { searchQuery, setSearchQuery, isSearchOpen, setSearchOpen, setView } = useAppStore();
  const { files } = useDriveStore();
  const { events } = useCalendarStore();
  const { notes } = useNotesStore();
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const found: SearchResult[] = [];

    files.forEach(f => {
      if (f.name.toLowerCase().includes(q)) {
        found.push({ id: f.id, type: 'file', title: f.name, subtitle: f.type === 'folder' ? 'Dossier' : 'Fichier', icon: 'file' });
      }
    });

    events.forEach(e => {
      if (e.title.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q)) {
        found.push({ id: e.id, type: 'event', title: e.title, subtitle: e.date, icon: 'calendar' });
      }
    });

    notes.forEach(n => {
      const strippedContent = n.content.replace(/<[^>]*>/g, '');
      if (n.title.toLowerCase().includes(q) || strippedContent.toLowerCase().includes(q)) {
        found.push({ id: n.id, type: 'note', title: n.title, subtitle: 'Note', icon: 'note' });
      }
    });

    setResults(found.slice(0, 8));
  }, [searchQuery, files, events, notes]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'file') setView('drive');
    else if (result.type === 'event') setView('calendar');
    else if (result.type === 'note') setView('notes');
    setSearchQuery('');
    setSearchOpen(false);
  };

  const IconFor = ({ type }: { type: string }) => {
    if (type === 'calendar') return <Calendar size={14} />;
    if (type === 'note') return <FileText size={14} />;
    return <FolderOpen size={14} />;
  };

  return (
    <div className="relative flex-1 max-w-lg">
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: isSearchOpen ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Search size={15} color="rgba(255,255,255,0.4)" />
        <input
          ref={inputRef}
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher dans Drive, Calendrier, Notes…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'rgba(255,255,255,0.85)', caretColor: '#818cf8' }}
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }}>
            <X size={14} color="rgba(255,255,255,0.4)" />
          </button>
        )}
      </div>

      {isSearchOpen && results.length > 0 && (
        <div
          className="absolute top-full mt-2 w-full rounded-xl overflow-hidden z-50 animate-fadeIn"
          style={{
            background: 'rgba(20,20,35,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => handleSelect(r)}
              className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors"
              style={{ color: 'rgba(255,255,255,0.8)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: 'rgba(129,140,248,0.8)' }}>
                <IconFor type={r.icon} />
              </span>
              <div>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
