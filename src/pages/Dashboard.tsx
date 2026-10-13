import { Link, useNavigate } from 'react-router-dom';
import { addDays } from 'date-fns';
import { ArrowUpRight, CalendarDays, Check, FolderClosed, NotebookText, Plus, Upload, Target, ListTodo, CalendarRange, SquareCheckBig, Clock3, Award } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useDrive, categoryOf, pathOf } from '../store/drive';
import { useNotes } from '../store/notes';
import { useCalendar, CATEGORIES, sortEvents, type CalendarEvent } from '../store/calendar';
import { fmt, toKey, todayKey, fromKey, weekStart, daysUntil } from '../lib/dates';
import { formatBytes, relativeTime, stripHtml, cx } from '../lib/utils';
import FileIcon from '../components/FileIcon';
import { hasRevisionPlan, linkToDay, linkToDriveFolder, linkToNote } from '../copilot/actions';
import { runOffer } from '../copilot/offers';
import { toast } from '../store/ui';
import { useFocusLog } from '../store/focusLog';
import { useBadges } from '../lib/badges';
import TodoList from './progress/TodoList';
import { dailyMinutes, formatMinutes, minutesBySubject, weekMinutes } from './progress/focusStats';
import { FOCUS_COLOR } from './progress/FocusCharts';

function Widget({ icon: Icon, title, to, className, color, children }: { icon: typeof CalendarDays; title: string; to?: string; className?: string; color: string; children: React.ReactNode }) {
  return (
    <section className={cx('card enter flex flex-col p-4', className)}>
      <header className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `color-mix(in srgb, ${color} 12%, var(--color-surface))`, color }}>
          <Icon size={14} strokeWidth={2} />
        </span>
        <h2 className="text-[13px] font-medium text-stone-600">{title}</h2>
        {to && (
          <Link to={to} className="ml-auto flex items-center gap-0.5 rounded px-1 text-[12px] text-stone-500 transition-colors hover:text-ink">
            Ouvrir <ArrowUpRight size={13} />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

const hm = (t?: string) => t ?? '';

function EventRow({ e, showDay }: { e: CalendarEvent; showDay?: boolean }) {
  const toggleDone = useCalendar(s => s.toggleDone);
  const c = CATEGORIES[e.category];
  return (
    <li className="group flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-stone-50">
      <button
        onClick={() => toggleDone(e.id)}
        className={cx('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors', e.done ? 'border-ink bg-ink' : 'border-stone-300 hover:border-stone-500')}
        title={e.done ? 'Marquer comme à faire' : 'Marquer comme fait'} aria-label={e.done ? 'Marquer comme à faire' : 'Marquer comme fait'}
      >
        {e.done && <Check size={10} strokeWidth={3} className="text-paper" />}
      </button>
      <span className="h-4 w-[3px] shrink-0 rounded-full" style={{ background: c.color }} />
      <Link to={linkToDay(e.date)} className="min-w-0 flex-1">
        <span className={cx('block truncate text-[13px]', e.done ? 'text-stone-500 line-through' : 'font-medium')}>{e.title}</span>
      </Link>
      <span className="tabular shrink-0 text-[12px] text-stone-500">
        {showDay && <span className="capitalize">{e.date === todayKey() ? "Auj." : fmt(fromKey(e.date), 'EEE d')} </span>}
        {hm(e.start)}
      </span>
    </li>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuth(s => s.user)!;
  const items = useDrive(s => s.items);
  const { notes, folders } = useNotes();
  const events = useCalendar(s => s.events);

  const now = new Date();
  const today = todayKey();
  const hour = now.getHours();
  const hello = hour < 5 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir';

  const todayEvents = events.filter(e => e.date === today).sort(sortEvents);
  const upcoming = events.filter(e => e.date > today && e.date <= toKey(addDays(now, 7))).sort(sortEvents);
  const nextExam = events.filter(e => e.category === 'examen' && e.date >= today && !e.done).sort(sortEvents)[0];
  const ws = weekStart(now);
  const weekDays = Array.from({ length: 7 }, (_, i) => toKey(addDays(ws, i)));
  const week = events.filter(e => e.date >= weekDays[0] && e.date <= weekDays[6]);
  const weekDone = week.filter(e => e.done).length;
  const perDay = weekDays.map(d => events.filter(e => e.date === d).length);
  const maxPerDay = Math.max(1, ...perDay);

  const recentNotes = [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const files = items.filter(i => i.kind === 'file');
  const recentFiles = [...files].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const used = files.reduce((s, f) => s + (f.size ?? 0), 0);
  const quota = 1024 ** 3;

  const sessions = useFocusLog(s => s.sessions);
  const focusWeek = weekMinutes(sessions);
  const focusDays = dailyMinutes(sessions, 7);
  const focusMax = Math.max(1, ...focusDays.map(d => d.minutes));
  const topSubjects = minutesBySubject(sessions, weekDays[0]).slice(0, 3);
  const badges = useBadges();
  const earnedBadges = badges.filter(b => b.earned).sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''));
  const nextBadge = badges.filter(b => !b.earned).sort((a, b) => b.current / b.target - a.current / a.target)[0];

  const planExam = () => {
    if (!nextExam) return;
    const r = runOffer({ label: 'Planifier', kind: 'plan_revisions', payload: { eventId: nextExam.id } });
    toast(r.links?.length ? 'Révisions planifiées et fiche créée' : r.text, 'success');
  };

  return (
    <div className="h-full overflow-y-auto px-4 pb-12 md:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-end gap-3 pb-6 pt-2">
          <div className="mr-auto">
            <p className="eyebrow first-letter:uppercase">{fmt(now, 'EEEE d MMMM')}</p>
            <h1 className="mt-0.5 text-[24px] font-semibold tracking-[-0.02em]">
              {hello}, {user.name}
            </h1>
          </div>
          <button onClick={() => navigate('/notes?nouvelle=1')} className="btn-secondary">
            <Plus size={15} /> Note
          </button>
          <button onClick={() => navigate('/calendrier?ajout=1')} className="btn-secondary">
            <CalendarDays size={15} /> Événement
          </button>
          <button onClick={() => navigate('/drive?import=1')} className="btn-primary">
            <Upload size={15} /> Importer
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
          {/* Today */}
          <Widget icon={ListTodo} title="Aujourd'hui" to={linkToDay(today)} className="xl:col-span-5" color="var(--color-brand-500)">
            {todayEvents.length === 0 ? (
              <p className="flex flex-1 items-center py-6 text-[13px] text-stone-500">Rien de prévu aujourd'hui.</p>
            ) : (
              <ul className="-mx-1.5">
                {todayEvents.map(e => (
                  <EventRow key={e.id} e={e} />
                ))}
              </ul>
            )}
          </Widget>

          {/* Next exam */}
          <Widget icon={Target} title="Prochain examen" className="xl:col-span-3" color="#d9483b">
            {nextExam ? (
              <div className="flex flex-1 flex-col">
                <Link to={linkToDay(nextExam.date)} className="group">
                  <p className={cx('tabular text-[40px] font-semibold leading-none tracking-[-0.03em]', daysUntil(nextExam.date) <= 3 ? 'text-[#d9483b] dark:text-[var(--cat-examen-text)]' : daysUntil(nextExam.date) <= 7 ? 'text-[#c47a10] dark:text-[var(--cat-devoir-text)]' : 'text-ink')}>
                    {daysUntil(nextExam.date) === 0 ? "Aujourd'hui" : `J-${daysUntil(nextExam.date)}`}
                  </p>
                  <p className="mt-2 truncate text-[13px] font-medium group-hover:underline">{nextExam.title}</p>
                  <p className="text-[12px] first-letter:uppercase text-stone-500">
                    {fmt(fromKey(nextExam.date), 'EEEE d MMMM')}
                    {nextExam.start && ` · ${nextExam.start}`}
                  </p>
                </Link>
                <div className="mt-auto pt-4">
                  {hasRevisionPlan(nextExam.title) ? (
                    <p className="flex items-center gap-1.5 text-[12px] text-stone-500">
                      <Check size={13} className="text-emerald-600" /> Révisions planifiées
                    </p>
                  ) : (
                    <button onClick={planExam} className="btn-secondary h-8 w-full text-[12px]">
                      Planifier les révisions
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="flex flex-1 items-center text-[13px] text-stone-500">Aucun examen à venir.</p>
            )}
          </Widget>

          {/* Week */}
          <Widget icon={CalendarRange} title="Cette semaine" to="/calendrier" className="md:col-span-2 xl:col-span-4" color="#2f9e6b">
            <div className="flex items-baseline gap-1.5">
              <span className="tabular text-[28px] font-semibold leading-none tracking-tight">{week.length - weekDone}</span>
              <span className="text-[13px] text-stone-500">
                {week.length === 0 ? 'rien de prévu' : week.length - weekDone === 0 ? 'tout est fait, bravo' : `tâche${week.length - weekDone > 1 ? 's' : ''} à faire`}
              </span>
              <span className="tabular ml-auto text-[12px] text-stone-500">
                {weekDone}/{week.length} faite{weekDone > 1 ? 's' : ''}
              </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-[#2f9e6b] transition-all" style={{ width: `${week.length ? (weekDone / week.length) * 100 : 0}%` }} />
            </div>
            <div className="mt-auto grid grid-cols-7 items-end gap-1.5 pt-5">
              {weekDays.map((d, i) => (
                <Link key={d} to={linkToDay(d)} className="group flex flex-col items-center gap-1.5">
                  <span className="flex h-12 w-full items-end justify-center">
                    <span
                      className={cx('w-full max-w-6 rounded-[4px] transition-colors', d === today ? 'bg-brand-500' : 'bg-stone-200 group-hover:bg-stone-300')}
                      style={{ height: `${Math.max(8, (perDay[i] / maxPerDay) * 100)}%` }}
                    />
                  </span>
                  <span className={cx('text-[11px] capitalize', d === today ? 'font-semibold text-ink' : 'text-stone-500')}>{fmt(fromKey(d), 'EEEEE')}</span>
                </Link>
              ))}
            </div>
          </Widget>

          {/* Upcoming */}
          <Widget icon={CalendarDays} title="À venir" to="/calendrier" className="xl:col-span-5" color="#7a5ad6">
            {upcoming.length === 0 ? (
              <p className="py-6 text-[13px] text-stone-500">Rien dans les 7 prochains jours.</p>
            ) : (
              <ul className="-mx-1.5">
                {upcoming.slice(0, 7).map(e => (
                  <EventRow key={e.id} e={e} showDay />
                ))}
              </ul>
            )}
          </Widget>

          {/* Notes */}
          <Widget icon={NotebookText} title="Notes récentes" to="/notes" className="xl:col-span-4" color="#d48a17">
            {recentNotes.length === 0 ? (
              <p className="py-6 text-[13px] text-stone-500">Aucune note pour l'instant.</p>
            ) : (
              <ul className="-mx-1.5 divide-y divide-stone-100">
                {recentNotes.map(n => (
                  <li key={n.id}>
                    <Link to={linkToNote(n.id)} className="block rounded-lg px-1.5 py-2 transition-colors hover:bg-stone-50">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{n.title}</span>
                        <span className="shrink-0 text-[11px] text-stone-500">{relativeTime(n.updatedAt)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-stone-500">
                        {folders.find(f => f.id === n.folderId)?.name ?? 'Notes'} · {stripHtml(n.content) || 'Vide'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Widget>

          {/* Drive */}
          <Widget icon={FolderClosed} title="Drive" to="/drive" className="xl:col-span-3" color="#3b6fd8">
            <div className="flex items-baseline justify-between text-[12px] text-stone-500">
              <span>
                <span className="tabular font-medium text-ink">{files.length}</span> fichier{files.length > 1 ? 's' : ''}
              </span>
              <span className="tabular">{formatBytes(used)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-[#3b6fd8]" style={{ width: `${Math.max(1, Math.min(100, (used / quota) * 100))}%` }} />
            </div>
            {recentFiles.length === 0 ? (
              <p className="mt-auto pt-6 text-[13px] text-stone-500">Importe ton premier fichier.</p>
            ) : (
              <ul className="-mx-1.5 mt-3">
                {recentFiles.map(f => (
                  <li key={f.id}>
                    <Link to={`${linkToDriveFolder(f.parentId)}${f.parentId ? '&' : '?'}fichier=${f.id}`} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-stone-50">
                      <FileIcon category={categoryOf(f)} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{f.name}</span>
                        <span className="block truncate text-[11px] text-stone-500">{['Drive', ...pathOf(items, f.parentId).map(p => p.name)].join(' / ')}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Widget>

          {/* To-do */}
          <Widget icon={SquareCheckBig} title="À faire" to="/progression#taches" className="xl:col-span-5" color="var(--color-brand-500)">
            <TodoList limit={6} />
          </Widget>

          {/* Focus time */}
          <Widget icon={Clock3} title="Temps de travail" to="/progression#travail" className="xl:col-span-4" color={FOCUS_COLOR}>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-semibold leading-none tracking-tight">{formatMinutes(focusWeek)}</span>
              <span className="text-[13px] text-stone-500">cette semaine</span>
            </div>
            {topSubjects.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {topSubjects.map(r => (
                  <li key={r.subject} className="flex items-center gap-2 text-[12px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: FOCUS_COLOR }} />
                    <span className="min-w-0 flex-1 truncate text-stone-600">{r.subject}</span>
                    <span className="tabular text-stone-500">{formatMinutes(r.minutes)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-stone-500">Lance une session focus pour suivre ton temps par matière.</p>
            )}
            <div className="mt-auto grid grid-cols-7 items-end gap-1.5 pt-4" role="img" aria-label="Minutes de focus sur les 7 derniers jours">
              {focusDays.map(d => (
                <span key={d.day} className="flex flex-col items-center gap-1.5" title={`${fmt(fromKey(d.day), 'EEEE d')} : ${d.minutes ? formatMinutes(d.minutes) : 'pas de session'}`}>
                  <span className="flex h-10 w-full items-end justify-center">
                    <span className="w-full max-w-6 rounded-t-[4px]" style={{ height: d.minutes ? `${Math.max(8, (d.minutes / focusMax) * 100)}%` : 2, background: d.minutes ? FOCUS_COLOR : 'var(--color-stone-200)' }} />
                  </span>
                  <span className={cx('text-[11px] capitalize', d.day === today ? 'font-semibold text-ink' : 'text-stone-500')}>{fmt(fromKey(d.day), 'EEEEE')}</span>
                </span>
              ))}
            </div>
          </Widget>

          {/* Badges */}
          <Widget icon={Award} title="Badges" to="/progression#badges" className="md:col-span-2 xl:col-span-3" color="#d48a17">
            <p className="text-[12px] text-stone-500">
              <span className="tabular text-[20px] font-semibold text-ink">{earnedBadges.length}</span> sur {badges.length} obtenus
            </p>
            {earnedBadges.length > 0 ? (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {earnedBadges.slice(0, 6).map(b => (
                    <span key={b.id} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--cat-devoir-soft)] text-[var(--cat-devoir-text)]" title={b.title}>
                      <b.icon size={15} />
                    </span>
                  ))}
                </div>
                <p className="mt-2 truncate text-[12px] text-stone-500">
                  Dernier : <span className="font-medium text-ink">{earnedBadges[0].title}</span>
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-stone-500">Ton premier badge n'est pas loin.</p>
            )}
            {nextBadge && (
              <div className="mt-auto pt-4">
                <p className="flex items-baseline gap-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate text-stone-600">
                    Prochain : <span className="font-medium text-ink">{nextBadge.title}</span>
                  </span>
                  <span className="tabular text-stone-500">
                    {nextBadge.current}/{nextBadge.target}
                  </span>
                </p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-stone-500" style={{ width: `${(nextBadge.current / nextBadge.target) * 100}%` }} />
                </div>
              </div>
            )}
          </Widget>
        </div>
      </div>
    </div>
  );
}
