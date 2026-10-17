import { useState } from 'react';
import { useToday } from '../lib/useToday';
import { Link, useNavigate } from 'react-router-dom';
import { addDays } from 'date-fns';
import { ArrowUpRight, CalendarDays, Check, Flag, Plus } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useNotes } from '../store/notes';
import { useCalendar, catOf, isBigEvent, sortEvents, type CalendarEvent } from '../store/calendar';
import { fmt, fmtDay, toKey, fromKey, weekStart, daysUntil, hasStarted } from '../lib/dates';
import { relativeTime, stripHtml, cx } from '../lib/utils';
import { hasRevisionPlan, revisionNote, linkToDay, linkToNote } from '../copilot/actions';
import { runOffer } from '../copilot/offers';
import { toast } from '../store/ui';
import TodoList from './tasks/TodoList';
import { useSettings } from '../store/settings';
import { WORDS } from '../lib/usage';
import { startTitleBuffer } from './notes/titleBuffer';

/** A bento tile: white by default, `dark` for the big day (the strongest tile of the page). */
function Widget({ title, to, linkLabel, className, dark, children }: { title: string; to?: string; linkLabel?: string; className?: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <section className={cx('card enter flex flex-col p-6', dark && 'bg-tile-dark text-white', className)}>
      <header className="mb-3 flex min-h-7 items-center gap-2">
        <h2 className={cx('text-[16px] font-bold tracking-[-0.01em]', dark ? 'text-white/70' : 'text-ink')}>{title}</h2>
        {to && (
          <Link to={to} className={cx('icon-btn ml-auto -mr-1.5 h-7 w-7', dark && 'text-white/70 hover:bg-white/10 hover:text-white')} title={linkLabel} aria-label={linkLabel}>
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
      {/* Taller on touch screens (36 px) without moving the row. */}
      <Link to={linkToDay(e.date)} className="min-w-0 flex-1 pointer-coarse:-my-2 pointer-coarse:py-2">
        <span className={cx('block truncate text-[13px]', e.done ? 'text-stone-500 line-through' : muted ? 'text-stone-600' : 'font-medium')}>{e.title}</span>
      </Link>
      <span className="tabular shrink-0 text-[12px] text-stone-500">
        {showDay && <span className="capitalize">{fmtDay(fromKey(e.date), daysUntil(e.date) < 7 ? 'EEE d' : 'EEE d MMM')} </span>}
        {e.start ?? ''}
      </span>
    </li>
  );
}

const preloadNotes = () => void import('./notes/NotesPage');

export default function Dashboard() {
  const words = WORDS[useSettings(st => st.usage)] ?? WORDS.etudes;
  const revisionTime = useSettings(st => st.revisionTime) || '18:00';
  const navigate = useNavigate();
  const user = useAuth(s => s.user)!;
  const { notes, folders } = useNotes();
  const events = useCalendar(s => s.events);

  const today = useToday();
  const now = new Date();
  const hour = now.getHours();
  // « Bonne nuit » is said when leaving, not to greet: late at night it is still « Bonsoir ».
  const hello = hour >= 5 && hour < 18 ? 'Bonjour' : 'Bonsoir';

  const todayEvents = events.filter(e => e.date === today).sort(sortEvents);
  // When the day is light, show what comes next so that the card is never a dead end.
  const nextCount = todayEvents.length === 0 ? 2 : todayEvents.length < 3 ? 1 : 0;
  const nextEvents = events.filter(e => e.date > today && !e.done).sort(sortEvents).slice(0, nextCount);
  // An exam already over today (end, else start, passed) is no longer the next one.
  const nowTime = fmt(now, 'HH:mm');
  // The nearest big day: an exam (deadline, « grand jour ») or any event marked important.
  const bigDays = events
    .filter(e => isBigEvent(e) && !e.done && (e.date > today || (e.date === today && (e.end ?? e.start ?? '24:00') > nowTime)))
    .sort(sortEvents);
  const nextExam = bigDays[0];
  // The ones after it, smaller: a big day two days later must not stay hidden behind the first.
  const laterBig = bigDays.slice(1, 3);
  const studies = words === WORDS.etudes;
  // In studies an important event that isn't an exam (job interview…) is no « Prochain examen », nor revised for.
  const notExam = !!nextExam && nextExam.category !== 'examen' && studies;
  const ws = weekStart(now);
  const weekDays = Array.from({ length: 7 }, (_, i) => toKey(addDays(ws, i)));
  const week = events.filter(e => e.date >= weekDays[0] && e.date <= weekDays[6]);
  const weekLeft = week.filter(e => !e.done).length;
  const perDay = weekDays.map(d => events.filter(e => e.date === d).length);
  const maxPerDay = Math.max(1, ...perDay);

  // « Maintenant » : what is on now, else the next thing today (the blue tile).
  const nowEvent = todayEvents.find(e => !e.done && e.start && (e.end ?? e.start) > nowTime);
  const minutesTo = nowEvent?.start ? Number(nowEvent.start.slice(0, 2)) * 60 + Number(nowEvent.start.slice(3)) - (now.getHours() * 60 + now.getMinutes()) : 0;

  const recentNotes = [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);

  const [tooLate, setTooLate] = useState<string>();
  const planExam = () => {
    if (!nextExam) return;
    const r = runOffer({ label: 'Planifier', kind: 'plan_revisions', payload: { eventId: nextExam.id } });
    // Only a plan with sessions links to the schedule: too late, Kompaly only made the sheet.
    const planned = r.links?.some(l => l.label === 'Voir le planning');
    if (planned) return toast(`${words.planned}, ${words === WORDS.etudes ? 'fiche créée' : 'note créée'}`, 'success');
    // Too late for a session: the sheet Kompaly made anyway is one tap away.
    const sheet = r.links?.find(l => l.to.startsWith('/notes'));
    setTooLate(nextExam.id); // the card now offers the sheet instead of the same message again
    toast(r.text, 'info', sheet && { label: sheet.label, run: () => navigate(sheet.to) });
  };

  // The sheet made for the next exam (with its sessions, or alone when it was too late for one).
  // (`notes` is read so the card follows its changes; revisionNote tells two exams of the same title apart.)
  const examSheet = nextExam && notes.length ? revisionNote(nextExam) : undefined;

  const examDays = nextExam ? daysUntil(nextExam.date) : 0;
  // Same rule as revisionSlot (copilot/actions): the evening before, once the usual time is gone and less than
  // 1 h 30 is left before midnight, no session fits any more (also true after a reload, unlike `tooLate`).
  const noTimeLeft = !!nextExam && (hasStarted(nextExam) || (examDays === 1 && nowTime > revisionTime && nowTime >= '22:30'));

  return (
    <div className="h-full overflow-y-auto px-4 pb-12 md:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-end gap-2 pb-7 pt-2">
          <div className="mr-auto">
            <p className="eyebrow first-letter:uppercase">{fmt(now, 'EEEE d MMMM')}</p>
            <h1 className="mt-0.5 text-[32px] font-extrabold tracking-[-0.035em]">
              {hello}, {user.name}
            </h1>
          </div>
          {/* Together: when the title is long, both shortcuts go to the next line, not just one. */}
          <div className="flex gap-2">
            {/* The page takes ~0.5 s to show up: what is typed meanwhile is kept and lands in the new note's title. */}
            <button
              onPointerEnter={preloadNotes}
              onFocus={preloadNotes}
              onClick={() => {
                startTitleBuffer();
                navigate('/notes?nouvelle=1');
              }}
              className="btn-ghost h-8 px-2.5 text-[13px]"
            >
              <Plus size={15} /> Note
            </button>
            <button onClick={() => navigate('/calendrier?ajout=1')} className="btn-ghost h-8 px-2.5 text-[13px]">
              <CalendarDays size={15} /> Événement
            </button>
          </div>
        </div>

        {/* Bento: tiles of different sizes; on a phone the DOM order is the priority order. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Now (blue tile) */}
          <Link to={nowEvent ? linkToDay(today) : '/calendrier?ajout=1'} className="enter flex min-h-[150px] flex-col justify-between rounded-[24px] bg-tile-blue p-6 text-white transition-[filter] hover:brightness-110 lg:col-start-1 lg:row-start-1">
            <span className="flex justify-between text-[13px] font-semibold text-white/80">
              <span>{nowEvent && minutesTo <= 0 ? 'En ce moment' : 'Ensuite aujourd’hui'}</span>
              {nowEvent && minutesTo > 0 && <span>{minutesTo < 60 ? `dans ${minutesTo} min` : `dans ${Math.floor(minutesTo / 60)} h ${String(minutesTo % 60).padStart(2, '0')}`}</span>}
            </span>
            {nowEvent ? (
              <span className="flex items-end justify-between gap-4">
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-[22px] font-extrabold leading-tight tracking-[-0.03em] [overflow-wrap:anywhere] sm:text-[26px]">{nowEvent.title}</span>
                  {nowEvent.details && <span className="block truncate text-[14px] text-white/80">{nowEvent.details.split('\n')[0]}</span>}
                </span>
                <span className="tabular shrink-0 text-[34px] font-extrabold leading-none tracking-[-0.04em] sm:text-[40px]">{nowEvent.start}</span>
              </span>
            ) : (
              <span className="text-[22px] font-extrabold tracking-[-0.02em]">Plus rien de prévu aujourd’hui. Ajouter quelque chose ?</span>
            )}
          </Link>

          {/* Next exam */}
          <Widget dark title={notExam ? 'Prochain grand jour' : words.nextBig} className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            {nextExam ? (
              <div className="flex flex-1 flex-col">
                <Link to={linkToDay(nextExam.date)} className="group flex flex-col gap-3">
                  <span className="flex items-baseline gap-3">
                    <span className="tabular text-[112px] font-extrabold leading-[0.8] tracking-[-0.06em] text-urgent">{examDays === 0 ? 'Auj.' : examDays}</span>
                    {examDays > 0 && <span className="text-[18px] font-bold">jour{examDays > 1 ? 's' : ''}</span>}
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5 text-[17px] font-bold group-hover:underline">
                      {nextExam.important && <Flag size={14} className="shrink-0 fill-urgent text-urgent" aria-label="Important" />}
                      <span className="truncate">{nextExam.title}</span>
                    </span>
                    <span className="block text-[13px] first-letter:uppercase text-white/65">
                      {fmtDay(fromKey(nextExam.date), 'EEEE d MMMM')}
                      {nextExam.start && ` · ${nextExam.start}`}
                    </span>
                  </span>
                </Link>
                {laterBig.length > 0 && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <p className="mb-1 text-[12px] font-semibold text-white/60">Ensuite</p>
                    <ul className="space-y-0.5">
                      {laterBig.map(e => {
                        const d = daysUntil(e.date);
                        return (
                          <li key={e.id}>
                            <Link to={linkToDay(e.date)} className="group flex items-center gap-2 rounded-md py-1 text-[12.5px] pointer-coarse:py-2">
                              <span className={cx('tabular w-9 shrink-0 font-bold', d <= 3 ? 'text-urgent' : 'text-white/70')}>{d === 0 ? 'Auj.' : `J-${d}`}</span>
                              <span className="min-w-0 truncate group-hover:underline">{e.title}</span>
                              <span className="ml-auto shrink-0 text-[12px] text-white/55">
                                {fmtDay(fromKey(e.date), 'EEE d MMM').replace(/^./, c => c.toUpperCase())}
                                {e.start && ` · ${e.start}`}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    {bigDays.length > 3 && (
                      <Link to="/calendrier" className="mt-1 inline-block text-[12px] text-white/55 hover:text-white hover:underline pointer-coarse:py-2">
                        +{bigDays.length - 3} autre{bigDays.length > 4 ? 's' : ''} dans le calendrier
                      </Link>
                    )}
                  </div>
                )}
                <div className="mt-auto pt-4">
                  {hasRevisionPlan(nextExam) ? (
                    <p className="flex items-center gap-1.5 text-[12px] text-white/65">
                      <Check size={13} className="text-emerald-400" /> {words.planned}
                    </p>
                  ) : examSheet && (examDays === 0 || tooLate === nextExam.id || noTimeLeft) ? (
                    // A sheet but no session and no time left for one: asking again would only repeat « Plus le temps… ».
                    <Link to={linkToNote(examSheet.id)} className="btn w-full bg-white text-tile-dark hover:bg-white/90">
                      {words === WORDS.etudes ? 'Ouvrir la fiche' : 'Ouvrir la note'}
                    </Link>
                  ) : hasStarted(nextExam) || notExam ? null : (
                    <button onClick={planExam} className="btn w-full bg-white text-tile-dark hover:bg-white/90">
                      {words.plan}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-1.5 text-[13px] text-white/65">
                <p>{words.noBig}</p>
                <p className="mt-1 flex items-center gap-1 text-[12px]">
                  <Flag size={12} className="shrink-0" /> Marque un événement comme important pour le voir ici.
                </p>
              </div>
            )}
          </Widget>

          {/* Today */}
          <Widget title="Aujourd’hui" to={linkToDay(today)} linkLabel="Ouvrir la journée dans le calendrier" className="lg:col-start-1 lg:row-start-2">
            {todayEvents.length === 0 ? (
              <p className="py-1.5 text-[13px] text-stone-500">Rien de prévu aujourd’hui.</p>
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

          {/* To-do */}
          <Widget title="À faire" to="/taches" linkLabel="Ouvrir toutes les tâches" className="lg:col-start-1 lg:row-span-2 lg:row-start-3">
            <TodoList limit={6} />
          </Widget>

          {/* Week */}
          <Widget title="Cette semaine" to="/calendrier" linkLabel="Ouvrir le calendrier" className="lg:col-start-2 lg:row-start-3">
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
                      className={cx('w-full max-w-6 rounded-[6px] transition-colors', d === today ? 'bg-tile-blue' : 'bg-brand-100 group-hover:bg-brand-200')}
                      style={{ height: perDay[i] ? `${Math.max(14, (perDay[i] / maxPerDay) * 100)}%` : 2 }}
                    />
                  </span>
                  <span className={cx('text-[11px] capitalize', d === today ? 'font-semibold text-ink' : 'text-stone-500')}>{fmt(fromKey(d), 'EEEEE')}</span>
                </Link>
              ))}
            </div>
          </Widget>

          {/* Notes */}
          <Widget title="Notes récentes" to="/notes" linkLabel="Ouvrir les notes" className="lg:col-start-2 lg:row-start-4">
            {recentNotes.length === 0 ? (
              <p className="py-1.5 text-[13px] text-stone-500">Aucune note pour l’instant.</p>
            ) : (
              <ul className="-mx-1.5">
                {recentNotes.map(n => (
                  <li key={n.id}>
                    <Link to={linkToNote(n.id)} className="flex items-baseline gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-stone-50 pointer-coarse:py-2" title={`${folders.find(f => f.id === n.folderId)?.name ?? 'Notes'} · ${stripHtml(n.content).slice(0, 120) || 'Vide'}`}>
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
