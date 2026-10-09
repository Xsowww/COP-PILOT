import { Link, useNavigate } from 'react-router-dom';
import { addDays } from 'date-fns';
import { CalendarDays, ChevronRight, FolderOpen, NotebookPen, Plus, Star, Target, Upload, Sparkles, Check } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useDrive, categoryOf, pathOf } from '../store/drive';
import { useNotes } from '../store/notes';
import { useCalendar, CATEGORIES, sortEvents } from '../store/calendar';
import { useCopilot } from '../store/copilot';
import { fmt, toKey, todayKey, fromKey, countdownLabel, weekStart } from '../lib/dates';
import { formatBytes, relativeTime, stripHtml, cx } from '../lib/utils';
import FileIcon from '../components/FileIcon';
import { linkToDay, linkToDriveFolder, linkToNote } from '../copilot/actions';

function WidgetTitle({ icon: Icon, title, to, color }: { icon: typeof CalendarDays; title: string; to?: string; color: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: color }}>
        <Icon size={15} />
      </span>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {to && (
        <Link to={to} className="ml-auto flex items-center text-xs font-medium text-slate-400 hover:text-indigo-600">
          Tout voir <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function ProgressRing({ value, size = 92 }: { value: number; size?: number }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth="9" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#ring)"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
      <defs>
        <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuth(s => s.user)!;
  const items = useDrive(s => s.items);
  const { notes, folders } = useNotes();
  const { events, toggleDone } = useCalendar();

  const today = todayKey();
  const now = new Date();
  const hour = now.getHours();
  const hello = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const todayEvents = events.filter(e => e.date === today).sort(sortEvents);
  const nowHm = fmt(now, 'HH:mm');
  const nextToday = todayEvents.find(e => !e.done && (!e.start || e.start >= nowHm));
  const upcoming = events.filter(e => e.date >= today && e.date <= toKey(addDays(now, 7))).sort(sortEvents);
  const nextExam = events.filter(e => e.category === 'examen' && e.date >= today && !e.done).sort(sortEvents)[0];
  const ws = toKey(weekStart(now));
  const we = toKey(addDays(weekStart(now), 6));
  const week = events.filter(e => e.date >= ws && e.date <= we);
  const weekDone = week.filter(e => e.done).length;

  const recentNotes = [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const files = items.filter(i => i.kind === 'file');
  const recentFiles = [...files].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const starred = items.filter(i => i.starred).slice(0, 4);
  const used = files.reduce((s, f) => s + (f.size ?? 0), 0);
  const quota = 1024 ** 3; // 1 Go symbolique (stockage du navigateur)

  return (
    <div className="h-full overflow-y-auto px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto grid max-w-6xl auto-rows-[minmax(170px,auto)] grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Greeting */}
        <section className="widget fade-up relative overflow-hidden bg-gradient-to-br from-indigo-500/90 via-violet-500/90 to-fuchsia-500/80 text-white sm:col-span-2">
          <p className="text-sm font-medium capitalize text-white/80">{fmt(now, 'EEEE d MMMM')}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {hello} {user.name} 👋
          </h1>
          <p className="mt-2 max-w-sm text-sm text-white/85">
            {todayEvents.length === 0
              ? "Rien au programme aujourd'hui. Parfait pour avancer sur tes projets."
              : `Tu as ${todayEvents.length} chose${todayEvents.length > 1 ? 's' : ''} aujourd'hui${nextToday ? `, la prochaine : ${nextToday.title}${nextToday.start ? ` à ${nextToday.start.replace(':', 'h')}` : ''}` : ''}.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => navigate('/notes?nouvelle=1')} className="btn bg-white/20 text-white backdrop-blur hover:bg-white/30">
              <Plus size={15} /> Note
            </button>
            <button onClick={() => navigate('/calendrier?ajout=1')} className="btn bg-white/20 text-white backdrop-blur hover:bg-white/30">
              <CalendarDays size={15} /> Événement
            </button>
            <button onClick={() => navigate('/drive?import=1')} className="btn bg-white/20 text-white backdrop-blur hover:bg-white/30">
              <Upload size={15} /> Importer
            </button>
          </div>
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -right-4 -top-12 h-32 w-32 rounded-full bg-white/10" />
        </section>

        {/* Next exam */}
        <Link to={nextExam ? linkToDay(nextExam.date) : '/calendrier'} className="widget fade-up flex flex-col" style={{ animationDelay: '40ms' }}>
          <WidgetTitle icon={Target} title="Prochain examen" color={CATEGORIES.examen.color} />
          {nextExam ? (
            <div className="flex flex-1 flex-col justify-between">
              <p className="text-5xl font-bold tracking-tight text-rose-500">{countdownLabel(nextExam.date)}</p>
              <div>
                <p className="truncate font-semibold text-slate-800">{nextExam.title}</p>
                <p className="text-xs capitalize text-slate-400">
                  {fmt(fromKey(nextExam.date), 'EEEE d MMMM')}
                  {nextExam.start && ` · ${nextExam.start.replace(':', 'h')}`}
                </p>
              </div>
            </div>
          ) : (
            <p className="flex flex-1 items-center text-sm text-slate-400">Aucun examen prévu. Respire 😌</p>
          )}
        </Link>

        {/* Week progress */}
        <Link to="/calendrier" className="widget fade-up flex flex-col" style={{ animationDelay: '80ms' }}>
          <WidgetTitle icon={Check} title="Ma semaine" color="#10b981" />
          <div className="flex flex-1 items-center gap-4">
            <div className="relative">
              <ProgressRing value={week.length ? weekDone / week.length : 0} />
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-slate-800">
                {week.length ? Math.round((weekDone / week.length) * 100) : 0}%
              </span>
            </div>
            <div className="text-sm text-slate-500">
              <p>
                <span className="font-semibold text-slate-800">{weekDone}</span> / {week.length} fait{weekDone > 1 ? 's' : ''}
              </p>
              <p className="mt-1 text-xs">{week.length - weekDone > 0 ? 'Continue comme ça 💪' : week.length ? 'Semaine bouclée 🎉' : 'Semaine vide'}</p>
            </div>
          </div>
        </Link>

        {/* Upcoming events */}
        <section className="widget fade-up sm:col-span-2 xl:row-span-2" style={{ animationDelay: '120ms' }}>
          <WidgetTitle icon={CalendarDays} title="À venir (7 jours)" to="/calendrier" color="#3b82f6" />
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Rien de prévu cette semaine.</p>
          ) : (
            <ul className="space-y-1.5">
              {upcoming.slice(0, 8).map(e => {
                const c = CATEGORIES[e.category];
                return (
                  <li key={e.id} className="group flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/80">
                    <button
                      onClick={() => toggleDone(e.id)}
                      className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition', e.done ? 'border-transparent' : 'hover:scale-110')}
                      style={{ borderColor: e.done ? undefined : c.color, background: e.done ? c.color : undefined }}
                      title={e.done ? 'Marquer comme à faire' : 'Marquer comme fait'}
                    >
                      {e.done && <Check size={12} className="text-white" />}
                    </button>
                    <Link to={linkToDay(e.date)} className="min-w-0 flex-1">
                      <p className={cx('truncate text-sm font-medium', e.done ? 'text-slate-400 line-through' : 'text-slate-800')}>
                        {c.emoji} {e.title}
                      </p>
                      <p className="text-xs capitalize text-slate-400">
                        {e.date === today ? "Aujourd'hui" : fmt(fromKey(e.date), 'EEEE d')}
                        {e.start && ` · ${e.start.replace(':', 'h')}`}
                      </p>
                    </Link>
                    <span className="chip" style={{ background: c.soft, color: c.text }}>
                      {c.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Notes */}
        <section className="widget fade-up sm:col-span-2" style={{ animationDelay: '160ms' }}>
          <WidgetTitle icon={NotebookPen} title="Notes récentes" to="/notes" color="#f59e0b" />
          {recentNotes.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Pas encore de notes.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {recentNotes.map(n => (
                <Link key={n.id} to={linkToNote(n.id)} className="rounded-2xl bg-amber-50/70 p-3 transition hover:bg-amber-50">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {n.pinned && '📌 '}
                    {n.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{stripHtml(n.content) || 'Note vide'}</p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {folders.find(f => f.id === n.folderId)?.name ?? 'Notes'} · {relativeTime(n.updatedAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Drive */}
        <section className="widget fade-up sm:col-span-2" style={{ animationDelay: '200ms' }}>
          <WidgetTitle icon={FolderOpen} title="Drive" to="/drive" color="#6366f1" />
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-500">
              <span>
                {files.length} fichier{files.length > 1 ? 's' : ''} · {items.length - files.length} dossier{items.length - files.length > 1 ? 's' : ''}
              </span>
              <span>{formatBytes(used)} utilisés</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${Math.max(2, Math.min(100, (used / quota) * 100))}%` }} />
            </div>
          </div>
          {(starred.length ? starred : recentFiles).length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">Importe ton premier fichier depuis le Drive.</p>
          ) : (
            <>
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {starred.length ? (
                  <>
                    <Star size={11} /> Favoris
                  </>
                ) : (
                  'Récents'
                )}
              </p>
              <ul className="space-y-1">
                {(starred.length ? starred : recentFiles).map(f => (
                  <li key={f.id}>
                    <Link
                      to={f.kind === 'folder' ? linkToDriveFolder(f.id) : `${linkToDriveFolder(f.parentId)}${f.parentId ? '&' : '?'}fichier=${f.id}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/80"
                    >
                      <FileIcon category={categoryOf(f)} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{f.name}</span>
                        <span className="block truncate text-[11px] text-slate-400">{['Drive', ...pathOf(items, f.parentId).map(p => p.name)].join(' › ')}</span>
                      </span>
                      {f.kind === 'file' && <span className="text-[11px] text-slate-400">{formatBytes(f.size)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Copilot */}
        <button
          onClick={() => useCopilot.getState().setPose('open')}
          className="widget fade-up flex flex-col text-left sm:col-span-2 xl:col-span-2"
          style={{ animationDelay: '240ms' }}
        >
          <WidgetTitle icon={Sparkles} title="Copilot" color="#8b5cf6" />
          <p className="text-sm text-slate-600">
            Le petit robot qui se cache sur le bord droit de ton écran. Demande-lui de <b>trouver un dossier</b>, d'<b>analyser ton calendrier</b> ou de{' '}
            <b>créer une note</b>.
          </p>
          <span className="mt-auto pt-3 text-sm font-semibold text-violet-600">Lui parler →</span>
        </button>
      </div>
    </div>
  );
}
