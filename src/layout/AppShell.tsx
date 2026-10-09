import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { House, FolderClosed, CalendarDays, NotebookText, LogOut, Search, FileText, Folder, CalendarClock, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '../store/auth';
import { loadUserData } from '../store/session';
import Copilot from '../copilot/Copilot';
import { startProactive } from '../copilot/proactive';
import { registerNavigate, search, type SearchHit } from '../copilot/actions';
import Logo from '../components/Logo';
import { cx } from '../lib/utils';

const NAV = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/drive', label: 'Drive', icon: FolderClosed },
  { to: '/calendrier', label: 'Calendrier', icon: CalendarDays },
  { to: '/notes', label: 'Notes', icon: NotebookText },
];

const HIT_ICON: Record<SearchHit['type'], typeof FileText> = {
  dossier: Folder,
  fichier: FileText,
  note: NotebookText,
  'dossier de notes': Folder,
  événement: CalendarClock,
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

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
    <div className="relative w-full max-w-[420px]">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
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
        placeholder="Rechercher"
        className="field w-full pl-9 pr-16"
      />
      <span className="kbd pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:inline-flex">{isMac ? '⌘' : 'Ctrl'} K</span>
      {open && q.trim() && (
        <div className="enter absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-pop">
          {hits.length === 0 && <p className="px-3 py-5 text-center text-[13px] text-stone-500">Aucun résultat pour « {q} »</p>}
          {hits.map((h, i) => {
            const Icon = HIT_ICON[h.type];
            return (
              <button
                key={h.type + h.id}
                onMouseDown={() => go(h)}
                onMouseEnter={() => setActive(i)}
                className={cx('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left', i === active && 'bg-stone-100')}
              >
                <Icon size={15} className="shrink-0 text-stone-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{h.title}</span>
                  <span className="block truncate text-[12px] text-stone-500">{h.where}</span>
                </span>
                <span className="text-[11px] capitalize text-stone-400">{h.type}</span>
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
  useEffect(() => startProactive(), []);

  const onLogout = async () => {
    logout();
    sessionStorage.removeItem('cop:greeted');
    await loadUserData();
    navigate('/connexion');
  };

  return (
    <div className="flex h-full">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-stone-200/80 px-3 pb-3 pt-4 md:flex">
        <div className="mb-6 px-2">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  'flex h-8 items-center gap-2.5 rounded-md border px-2 text-[13px] font-medium transition-colors',
                  isActive ? 'border-stone-200 bg-white text-ink shadow-card' : 'border-transparent text-stone-600 hover:bg-stone-100 hover:text-ink',
                )
              }
            >
              <n.icon size={16} strokeWidth={1.9} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="relative">
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="enter absolute bottom-12 left-0 right-0 z-20 rounded-xl border border-stone-200 bg-white p-1 shadow-pop">
                <p className="truncate px-2.5 pb-1.5 pt-1 text-[12px] text-stone-500">{user.email}</p>
                <button onClick={onLogout} className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[13px] text-stone-700 hover:bg-stone-100">
                  <LogOut size={14} /> Se déconnecter
                </button>
              </div>
            </>
          )}
          <button onClick={() => setMenu(m => !m)} className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-stone-100">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[12px] font-semibold text-stone-700">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{user.name}</span>
            <ChevronsUpDown size={14} className="text-stone-400" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 px-4 md:px-8">
          <span className="md:hidden">
            <Logo />
          </span>
          <div className="hidden flex-1 md:block">
            <GlobalSearch />
          </div>
          <button onClick={onLogout} className="icon-btn ml-auto md:hidden" title="Se déconnecter">
            <LogOut size={17} />
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden pb-14 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-stone-200 bg-paper/95 backdrop-blur md:hidden">
        {NAV.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-ink' : 'text-stone-400')}
          >
            <n.icon size={19} strokeWidth={1.9} />
            {n.label}
          </NavLink>
        ))}
      </nav>

      <Copilot />
    </div>
  );
}
