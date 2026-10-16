import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { House, FolderClosed, CalendarDays, NotebookText, Search, FileText, Folder, CalendarClock, Settings2, ChartNoAxesColumn, ListChecks, Users, Trash2 } from 'lucide-react';
import { useAuth } from '../store/auth';
import Copilot from '../copilot/Copilot';
import Tour from '../components/Tour';
import { startProactive } from '../copilot/proactive';
import { registerNavigate, search, type SearchHit } from '../copilot/actions';
import Logo from '../components/Logo';
import Avatar from '../components/Avatar';
import FocusTimer from '../components/FocusTimer';
import { cx } from '../lib/utils';
import { checkIsAdmin, cloudEnabled } from '../lib/supabase';
import { useGroupActivity, totalUnread } from '../store/groupActivity';
import { useTrashCount } from '../lib/trash';
import { useSettings } from '../store/settings';
import { WORDS } from '../lib/usage';

const SPACE_COLORS = { home: 'var(--color-brand-500)', drive: '#3b6fd8', calendar: '#d9483b', notes: '#d48a17' };

const NAV = [
  { to: '/', label: 'Accueil', icon: House, end: true, color: SPACE_COLORS.home },
  { to: '/calendrier', label: 'Calendrier', icon: CalendarDays, color: SPACE_COLORS.calendar },
  { to: '/taches', label: 'Tâches', icon: ListChecks, color: '#2f9e6b' },
  { to: '/notes', label: 'Notes', icon: NotebookText, color: SPACE_COLORS.notes },
  { to: '/drive', label: 'Drive', icon: FolderClosed, color: SPACE_COLORS.drive },
  { to: '/groupes', label: 'Groupes', icon: Users, color: '#1f8a8a' },
];

const HIT_ICON: Record<SearchHit['type'], typeof FileText> = {
  dossier: Folder,
  fichier: FileText,
  note: NotebookText,
  'dossier de notes': Folder,
  événement: CalendarClock,
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** `onDone(cancelled)`: closed with Échap (true) or a result chosen (false). */
function GlobalSearch({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: (cancelled: boolean) => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = q.trim() ? search(q, 8) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Only the copy on screen (the desktop one is hidden below 1024 px: AppShell opens the other).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && inputRef.current?.offsetParent) {
        e.preventDefault();
        // Not from behind an open dialog (file preview…): its results would sit under the dimmed backdrop.
        if (document.querySelector('[aria-modal="true"]')) return;
        if (document.activeElement !== inputRef.current) before.current = document.activeElement as HTMLElement | null;
        inputRef.current.focus();
        inputRef.current.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keyboard users: back where they were after Échap, on the page content after a result (not on <body>).
  const before = useRef<HTMLElement | null>(null);
  const leave = (to: HTMLElement | null) => {
    inputRef.current?.blur();
    if (!onDone) setTimeout(() => (to?.isConnected ? to : document.getElementById('contenu'))?.focus(), 0);
  };

  const go = (hit: SearchHit) => {
    navigate(hit.to);
    setQ('');
    setOpen(false);
    leave(null);
    onDone?.(false);
  };

  return (
    <div className={cx('relative w-full', !onDone && 'max-w-[300px]')}>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={q}
        onChange={e => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {
          // The arrows move in the results, not the caret.
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(a => (e.key === 'ArrowDown' ? Math.min(a + 1, hits.length - 1) : Math.max(a - 1, 0)));
          }
          if (e.key === 'Enter' && hits[active]) go(hits[active]);
          if (e.key === 'Escape') {
            setQ('');
            leave(before.current);
            onDone?.(true);
          }
        }}
        placeholder="Rechercher"
        aria-label="Rechercher dans tes fichiers, notes et événements"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && !!q.trim()}
        aria-controls="recherche-resultats"
        aria-activedescendant={open && hits[active] ? `recherche-${active}` : undefined}
        className="h-8 w-full rounded-lg border border-transparent bg-stone-100/70 pl-8 pr-14 text-[13px] text-ink outline-none transition placeholder:text-stone-500 hover:bg-stone-100 focus:border-focus focus:bg-surface focus:shadow-card focus:ring-1 focus:ring-focus"
      />
      <span aria-hidden className="kbd pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 border-transparent bg-transparent sm:inline-flex">{isMac ? '⌘' : 'Ctrl'} K</span>
      {open && q.trim() && (
        <div id="recherche-resultats" role="listbox" aria-label="Résultats de recherche" className="enter absolute left-0 right-0 top-10 z-40 overflow-hidden rounded-xl border border-stone-200 bg-surface p-1 shadow-pop">
          {hits.length === 0 && <p className="px-3 py-5 text-center text-[13px] text-stone-500">Aucun résultat pour «&nbsp;{q}&nbsp;»</p>}
          {hits.map((h, i) => {
            const Icon = HIT_ICON[h.type];
            return (
              <button
                key={h.type + h.id}
                id={`recherche-${i}`}
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                onMouseDown={() => go(h)}
                onMouseEnter={() => setActive(i)}
                className={cx('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left', i === active && 'bg-stone-100')}
              >
                <Icon size={15} className="shrink-0 text-stone-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{h.title}</span>
                  <span className="block truncate text-[12px] text-stone-500">{h.where}</span>
                </span>
                <span className="inline-block shrink-0 text-[11px] text-stone-500 first-letter:uppercase">{h.type}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const groupsLabel = (WORDS[useSettings(st => st.usage)] ?? WORDS.etudes).groups;
  const label = (n: { to: string; label: string }) => (n.to === '/groupes' ? groupsLabel : n.label);
  const navigate = useNavigate();
  const user = useAuth(s => s.user)!;
  const trashCount = useTrashCount();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBtn = useRef<HTMLButtonElement>(null);
  // Another page: the search field opened on a phone closes.
  const { pathname } = useLocation();
  const [searchPath, setSearchPath] = useState(pathname);
  if (searchPath !== pathname) {
    setSearchPath(pathname);
    setSearchOpen(false);
  }
  // Ctrl+K on a narrow window: no search field in the header, open the one under it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !window.matchMedia('(min-width: 1024px)').matches) {
        e.preventDefault();
        if (!document.querySelector('[aria-modal="true"]')) setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const trashLabel = trashCount ? `Corbeille, ${trashCount} élément${trashCount > 1 ? 's' : ''}` : 'Corbeille';

  useEffect(() => registerNavigate(navigate), [navigate]);
  useEffect(() => startProactive(), []);

  // Nouveautés dans les groupes : pastilles + notifications (version en ligne).
  useEffect(() => {
    if (!cloudEnabled) return;
    void useGroupActivity.getState().start();
    return () => useGroupActivity.getState().stop();
  }, [user.id]);
  const groupNews = useGroupActivity(s => Object.values(s.unread).reduce((n, c) => n + totalUnread(c), 0));

  // Lien « Administration » : seulement pour les comptes déclarés dans public.admins.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    checkIsAdmin().then(ok => alive && setIsAdmin(ok), () => {});
    return () => {
      alive = false;
    };
  }, [user.id]);

  return (
    <div className="flex h-full">
      <a href="#contenu" className="skip-link" onClick={e => { e.preventDefault(); document.getElementById('contenu')?.focus(); }}>
        Aller au contenu
      </a>
      {/* Sidebar (desktop) */}
      <aside aria-label="Barre latérale" className="hidden w-[256px] shrink-0 flex-col border-r border-stone-200/80 px-3 pb-3 pt-4 lg:flex">
        <div className="mb-6 px-2">
          <Logo />
        </div>
        <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-1">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  'flex h-10 items-center gap-3 rounded-lg border px-2.5 text-[14px] font-medium transition-colors',
                  isActive ? 'border-stone-200 bg-surface text-ink shadow-card' : 'border-transparent text-stone-600 hover:bg-stone-100 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <n.icon size={18} strokeWidth={1.9} style={{ color: isActive ? n.color : undefined }} />
                  {label(n)}
                  {n.to === '/groupes' && groupNews > 0 && (
                    <span className="ml-auto rounded-full bg-brand-solid px-1.5 text-[11px] font-semibold leading-[18px] text-on-brand tabular" aria-label={`${groupNews} nouveautés dans tes ${groupsLabel.toLowerCase()}`}>
                      {groupNews}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cx(
                  'mt-4 flex h-10 items-center gap-3 rounded-lg border px-2.5 text-[14px] font-medium transition-colors',
                  isActive ? 'border-stone-200 bg-surface text-ink shadow-card' : 'border-transparent text-stone-500 hover:bg-stone-100 hover:text-ink',
                )
              }
            >
              <ChartNoAxesColumn size={18} strokeWidth={1.9} />
              Administration
            </NavLink>
          )}
        </nav>
        <NavLink
          to="/corbeille"
          aria-label={trashLabel}
          className={({ isActive }) =>
            cx(
              'mb-2 mt-2 flex h-10 items-center gap-3 rounded-lg border px-2.5 text-[14px] transition-colors',
              isActive ? 'border-stone-200 bg-surface font-medium text-ink shadow-card' : 'border-transparent text-stone-500 hover:bg-stone-100 hover:text-ink',
            )
          }
        >
          <Trash2 size={18} strokeWidth={1.9} />
          <span className="flex-1">Corbeille</span>
          {trashCount > 0 && <span className="tabular text-[11px] text-stone-500">{trashCount}</span>}
        </NavLink>
        <FocusTimer />
        <NavLink
          to="/profil"
          className={({ isActive }) => cx('group flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-stone-100', isActive && 'bg-stone-100')}
          title="Profil et réglages"
        >
          <Avatar size={28} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{user.name}</span>
            <span className="block truncate text-[11px] text-stone-500">Profil et réglages</span>
          </span>
          <Settings2 size={15} className="text-stone-400 transition-colors group-hover:text-ink" />
        </NavLink>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 px-4 md:px-8">
          <span className="lg:hidden">
            <Logo />
          </span>
          <div className="hidden flex-1 lg:block">
            <GlobalSearch />
          </div>
          <button
            ref={searchBtn}
            type="button"
            className="icon-btn ml-auto lg:hidden"
            title="Rechercher"
            aria-label="Rechercher"
            aria-expanded={searchOpen}
            aria-controls={searchOpen ? 'recherche-mobile' : undefined}
            onClick={() => setSearchOpen(o => !o)}
          >
            <Search size={18} strokeWidth={1.9} />
          </button>
          <NavLink to="/corbeille" className="icon-btn relative lg:hidden" title="Corbeille" aria-label={trashLabel}>
            <Trash2 size={18} strokeWidth={1.9} />
            {trashCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-paper" aria-hidden />}
          </NavLink>
          <NavLink to="/profil" className="inline-flex h-9 w-9 items-center justify-center rounded-full lg:hidden" title="Profil et réglages" aria-label="Profil et réglages">
            <Avatar size={30} />
          </NavLink>
        </header>
        {searchOpen && (
          <div id="recherche-mobile" className="px-4 pb-2 md:px-8 lg:hidden">
            <GlobalSearch
              autoFocus
              onDone={cancelled => {
                setSearchOpen(false);
                // Échap: back to the magnifier, not to the top of the page.
                if (cancelled) searchBtn.current?.focus();
                // A result opened: on the page content, not on <body>.
                else setTimeout(() => document.getElementById('contenu')?.focus(), 0);
              }}
            />
          </div>
        )}
        <main id="contenu" tabIndex={-1} className="min-h-0 flex-1 overflow-hidden pb-14 outline-none lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav aria-label="Navigation principale" className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-stone-200 bg-paper/95 backdrop-blur lg:hidden">
        {NAV.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-ink' : 'text-stone-500')}
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <n.icon size={19} strokeWidth={1.9} style={{ color: isActive ? n.color : undefined }} />
                  {n.to === '/groupes' && groupNews > 0 && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-brand-solid ring-2 ring-paper" aria-label="nouveautés" />}
                </span>
                {label(n)}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Copilot />
      <Tour />
    </div>
  );
}
