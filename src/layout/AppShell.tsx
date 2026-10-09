import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutGrid, FolderOpen, CalendarDays, NotebookPen, LogOut, Search, FileText, Folder, CalendarClock } from 'lucide-react';
import { useAuth } from '../store/auth';
import { loadUserData } from '../store/session';
import { useCopilot } from '../store/copilot';
import { useCalendar } from '../store/calendar';
import Copilot from '../copilot/Copilot';
import { registerNavigate, search, type SearchHit } from '../copilot/actions';
import { welcomeLine } from '../copilot/localBrain';
import { cx } from '../lib/utils';

const NAV = [
  { to: '/', label: 'Accueil', icon: LayoutGrid, end: true },
  { to: '/drive', label: 'Drive', icon: FolderOpen },
  { to: '/calendrier', label: 'Calendrier', icon: CalendarDays },
  { to: '/notes', label: 'Notes', icon: NotebookPen },
];

const HIT_ICON: Record<SearchHit['type'], typeof FileText> = {
  dossier: Folder,
  fichier: FileText,
  note: NotebookPen,
  'dossier de notes': Folder,
  événement: CalendarClock,
};

function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = q.trim() ? search(q, 8) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (hit: SearchHit) => {
    navigate(hit.to);
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        value={q}
        onChange={e => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') setActive(a => Math.min(a + 1, hits.length - 1));
          if (e.key === 'ArrowUp') setActive(a => Math.max(a - 1, 0));
          if (e.key === 'Enter' && hits[active]) go(hits[active]);
          if (e.key === 'Escape') inputRef.current?.blur();
        }}
        placeholder="Rechercher partout…"
        className="field w-full rounded-2xl border-white/60 bg-white/70 pl-10 pr-14"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 text-[10px] text-slate-400 sm:block">Ctrl K</kbd>
      {open && q.trim() && (
        <div className="fade-up absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl">
          {hits.length === 0 && <p className="px-3 py-4 text-center text-sm text-slate-400">Aucun résultat pour « {q} »</p>}
          {hits.map((h, i) => {
            const Icon = HIT_ICON[h.type];
            return (
              <button
                key={h.type + h.id}
                onMouseDown={() => go(h)}
                onMouseEnter={() => setActive(i)}
                className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left', i === active && 'bg-indigo-50')}
              >
                <Icon size={16} className="shrink-0 text-indigo-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{h.title}</span>
                  <span className="block truncate text-xs text-slate-400">{h.where}</span>
                </span>
                <span className="text-[11px] capitalize text-slate-400">{h.type}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const user = useAuth(s => s.user)!;
  const logout = useAuth(s => s.logout);
  const [menu, setMenu] = useState(false);

  useEffect(() => registerNavigate(navigate), [navigate]);

  // Copilot greets once per browser session.
  useEffect(() => {
    if (sessionStorage.getItem('cop:greeted')) return;
    sessionStorage.setItem('cop:greeted', '1');
    const t = setTimeout(() => useCopilot.getState().say(welcomeLine(user.name)), 1400);
    return () => clearTimeout(t);
  }, [user.name]);

  // Copilot reacts when an exam is added.
  useEffect(
    () =>
      useCalendar.subscribe((s, prev) => {
        if (s.events.length <= prev.events.length) return;
        const added = s.events[s.events.length - 1];
        if (added.category === 'examen' && useCopilot.getState().pose !== 'open') {
          useCopilot.getState().say(`Examen « ${added.title} » noté 🎯 Pense à planifier des séances de révision avant. Je peux te créer une fiche si tu me le demandes !`);
        }
      }),
    [],
  );

  const onLogout = async () => {
    logout();
    sessionStorage.removeItem('cop:greeted');
    await loadUserData();
    navigate('/connexion');
  };

  return (
    <div className="app-backdrop flex h-full">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/60 bg-white/40 px-3 py-5 backdrop-blur-xl md:flex">
        <div className="mb-7 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/30">C</div>
          <div>
            <p className="text-sm font-bold tracking-tight">COP-PILOT</p>
            <p className="text-[11px] text-slate-400">Ton hub étudiant</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800',
                )
              }
            >
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="relative">
          <button onClick={() => setMenu(m => !m)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-white/70">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-rose-400 text-sm font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-[11px] text-slate-400">{user.email}</p>
            </div>
          </button>
          {menu && (
            <div className="fade-up absolute bottom-14 left-0 right-0 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
              <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                <LogOut size={15} /> Se déconnecter
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 px-4 pb-2 pt-4 md:px-8">
          <GlobalSearch />
          <button onClick={onLogout} className="icon-btn ml-auto md:hidden" title="Se déconnecter">
            <LogOut size={18} />
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-white/60 bg-white/80 backdrop-blur-xl md:hidden">
        {NAV.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-indigo-600' : 'text-slate-400')}
          >
            <n.icon size={20} />
            {n.label}
          </NavLink>
        ))}
      </nav>

      <Copilot />
    </div>
  );
}
