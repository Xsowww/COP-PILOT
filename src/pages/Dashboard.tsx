import { useToday } from '../lib/useToday';
import { Link, useNavigate } from 'react-router-dom';
import { addDays } from 'date-fns';
import { ArrowUpRight, CalendarDays, Check, Plus } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useNotes } from '../store/notes';
import { useCalendar, catOf, sortEvents, type CalendarEvent } from '../store/calendar';
import { fmt, toKey, fromKey, weekStart, daysUntil } from '../lib/dates';
import { relativeTime, stripHtml, cx } from '../lib/utils';
import { hasRevisionPlan, linkToDay, linkToNote } from '../copilot/actions';
import { runOffer } from '../copilot/offers';
import { toast } from '../store/ui';
import TodoList from './tasks/TodoList';
import { useSettings } from '../store/settings';
import { WORDS } from '../lib/usage';

function Widget({ title, to, linkLabel, className, children }: { title: string; to?: string; linkLabel?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cx('card enter flex flex-col p-5', className)}>
      <header className="mb-3 flex min-h-7 items-center gap-2">
        <h2 className="text-[13px] font-medium text-stone-600">{title}</h2>
        {to && (
          <Link to={to} className="icon-btn ml-auto -mr-1.5 h-7 w-7" title={linkLabel} aria-label={linkLabel}>
            <ArrowUpRight size={15} />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function EventRow({ e, showDay, muted }: { e: CalendarEvent; showDay?: boolean; muted?: boolean }) {
  const toggleDone = useCalendar(s => s.toggleDone);
  const c = catOf(e.category);
  return (
    <li className="group flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-stone-50">
      <button
        onClick={() => toggleDone(e.id)}
        className={cx('hit flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors', e.done ? 'border-ink bg-ink' : 'border-stone-300 hover:border-stone-500')}
        title={e.done ? 'Marquer comme à faire' : 'Marquer comme fait'}
        aria-label={e.done ? `Remettre « ${e.title} » à faire` : `Marquer « ${e.title} » comme fait`}
      >
        {e.done && <Check size={10} strokeWidth={3} className="text-paper" />}
      </button>
      <span className="h-4 w-[3px] shrink-0 rounded-full" style={{ background: c.color }} />
      <Link to={linkToDay(e.date)} className="min-w-0 flex-1">
        <span className={cx('block truncate text-[13px]', e.done ? 'text-stone-500 line-through' : muted ? 'text-stone-600' : 'font-medium')}>{e.title}</span>
      </Link>
      <span className="tabular shrink-0 text-[12px] text-stone-500">
        {showDay && <span className="capitalize">{fmt(fromKey(e.date), 'EEE d')} </span>}
        {e.start ?? ''}
      </span>
    </li>
  );
}

export default function Dashboard() {
  const words = WORDS[useSettings(st => st.usage)] ?? WORDS.etudes;
  const navigate = useNavigate();
  const user = useAuth(s => s.user)!;
  const { notes, folders } = useNotes();
  const events = useCalendar(s => s.events);

  const today = useToday();
  const now = new Date();
  const hour = now.getHours();
  const hello = hour < 5 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir';

  const todayEvents = events.filter(e => e.date === today).sort(sortEvents);
  // When the day is light, show what comes next so that the card is never a dead end.
  const nextCount = todayEvents.length === 0 ? 2 : todayEvents.length < 3 ? 1 : 0;
  const nextEvents = events.filter(e => e.date > today && !e.done).sort(sortEvents).slice(0, nextCount);
  const nextExam = events.filter(e => e.category === 'examen' && e.date >= today && !e.done).sort(sortEvents)[0];
  const ws = weekStart(now);
  const weekDays = Array.from({ length: 7 }, (_, i) => toKey(addDays(ws, i)));
  const week = events.filter(e => e.date >= weekDays[0] && e.date <= weekDays[6]);
  const weekLeft = week.filter(e => !e.done).length;
  const perDay = weekDays.map(d => events.filter(e => e.date === d).length);
  const maxPerDay = Math.max(1, ...perDay);

  const recentNotes = [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);

  const planExam = () => {
    if (!nextExam) return;
    const r = runOffer({ label: 'Planifier', kind: 'plan_revisions', payload: { eventId: nextExam.id } });
    toast(r.links?.length ? 'Révisions planifiées et fiche créée' : r.text, 'success');
  };

  const examDays = nextExam ? daysUntil(nextExam.date) : 0;

  return (
    <div className="h-full overflow-y-auto px-4 pb-12 md:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-end gap-2 pb-7 pt-2">
          <div className="mr-auto">
            <p className="eyebrow first-letter:uppercase">{fmt(now, 'EEEE d MMMM')}</p>
            <h1 className="mt-0.5 text-[24px] font-semibold tracking-[-0.02em]">
              {hello}, {user.name}
            </h1>
          </div>
          <button onClick={() => navigate('/notes?nouvelle=1')} className="btn-ghost h-8 px-2.5 text-[13px]">
            <Plus size={15} /> Note
          </button>
          <button onClick={() => navigate('/calendrier?ajout=1')} className="btn-ghost h-8 px-2.5 text-[13px]">
            <CalendarDays size={15} /> Événement
          </button>
        </div>

        {/* Two columns on large screens; on a phone the DOM order is the priority order. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Today */}
          <Widget title="Aujourd'hui" to={linkToDay(today)} linkLabel="Ouvrir la journée dans le calendrier" className="lg:col-start-1 lg:row-start-1">
            {todayEvents.length === 0 ? (
              <p className="py-1.5 text-[13px] text-stone-500">Rien de prévu aujourd'hui.</p>
            ) : (
              <ul className="-mx-1.5">
                {todayEvents.map(e => (
                  <EventRow key={e.id} e={e} />
                ))}
              </ul>
            )}
            {nextEvents.length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="eyebrow mb-0.5">Ensuite</p>
                <ul className="-mx-1.5">
                  {nextEvents.map(e => (
                    <EventRow key={e.id} e={e} showDay muted />
                  ))}
                </ul>
              </div>
            )}
          </Widget>

          {/* Next exam */}
          <Widget title={words.nextBig} className="lg:col-start-2 lg:row-start-1">
            {nextExam ? (
              <div className="flex flex-1 flex-col">
                <Link to={linkToDay(nextExam.date)} className="group flex items-baseline gap-3">
                  <span className={cx('tabular shrink-0 text-[32px] font-semibold leading-none tracking-[-0.03em]', examDays <= 3 ? 'text-[var(--cat-examen-text)]' : 'text-ink')}>
                    {examDays === 0 ? "Auj." : `J-${examDays}`}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium group-hover:underline">{nextExam.title}</span>
                    <span className="block text-[12px] first-letter:uppercase text-stone-500">
                      {fmt(fromKey(nextExam.date), 'EEEE d MMMM')}
                      {nextExam.start && ` · ${nextExam.start}`}
                    </span>
                  </span>
                </Link>
                <div className="mt-auto pt-4">
                  {hasRevisionPlan(nextExam.title) ? (
                    <p className="flex items-center gap-1.5 text-[12px] text-stone-500">
                      <Check size={13} className="text-emerald-600" /> {words.planned}
                    </p>
                  ) : (
                    <button onClick={planExam} className="btn-secondary h-8 text-[12px]">
                      {words.plan}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-1.5 text-[13px] text-stone-500">{words.noBig}</p>
            )}
          </Widget>

          {/* To-do */}
          <Widget title="À faire" to="/taches" linkLabel="Ouvrir toutes les tâches" className="lg:col-start-1 lg:row-span-2 lg:row-start-2">
            <TodoList limit={6} />
          </Widget>

          {/* Week */}
          <Widget title="Cette semaine" to="/calendrier" linkLabel="Ouvrir le calendrier" className="lg:col-start-2 lg:row-start-2">
            <p className="text-[13px] text-stone-500">
              {week.length === 0 ? (
                'Rien de prévu.'
              ) : weekLeft === 0 ? (
                'Tout est fait.'
              ) : (
                <>
                  <span className="tabular font-semibold text-ink">{weekLeft}</span> à faire sur {week.length}
                </>
              )}
            </p>
            <div className="mt-auto grid grid-cols-7 items-end gap-1.5 pt-4">
              {weekDays.map((d, i) => (
                <Link key={d} to={linkToDay(d)} className="group flex flex-col items-center gap-1.5" aria-label={`${fmt(fromKey(d), 'EEEE d MMMM')} : ${perDay[i]} élément${perDay[i] > 1 ? 's' : ''}`}>
                  <span className="flex h-10 w-full items-end justify-center">
                    <span
                      className={cx('w-full max-w-5 rounded-[3px] transition-colors', d === today ? 'bg-ink' : 'bg-stone-200 group-hover:bg-stone-300')}
                      style={{ height: perDay[i] ? `${Math.max(14, (perDay[i] / maxPerDay) * 100)}%` : 2 }}
                    />
                  </span>
                  <span className={cx('text-[11px] capitalize', d === today ? 'font-semibold text-ink' : 'text-stone-500')}>{fmt(fromKey(d), 'EEEEE')}</span>
                </Link>
              ))}
            </div>
          </Widget>

          {/* Notes */}
          <Widget title="Notes récentes" to="/notes" linkLabel="Ouvrir les notes" className="lg:col-start-2 lg:row-start-3">
            {recentNotes.length === 0 ? (
              <p className="py-1.5 text-[13px] text-stone-500">Aucune note pour l'instant.</p>
            ) : (
              <ul className="-mx-1.5">
                {recentNotes.map(n => (
                  <li key={n.id}>
                    <Link to={linkToNote(n.id)} className="flex items-baseline gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-stone-50" title={`${folders.find(f => f.id === n.folderId)?.name ?? 'Notes'} · ${stripHtml(n.content).slice(0, 120) || 'Vide'}`}>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{n.title}</span>
                      <span className="shrink-0 text-[11px] text-stone-500">{relativeTime(n.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        </div>
      </div>
    </div>
  );
}
