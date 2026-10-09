import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, addMonths, endOfMonth, startOfMonth, isSameMonth } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Sparkles, Trash2, CornerDownLeft } from 'lucide-react';
import { useCalendar, CATEGORIES, guessCategory, sortEvents, type CalendarEvent, type EventCategory } from '../../store/calendar';
import { parseQuickAdd, toKey, fromKey, todayKey, fmt, weekStart, countdownLabel, daysUntil } from '../../lib/dates';
import { toast } from '../../store/ui';
import { cx } from '../../lib/utils';
import EventForm from './EventForm';

const hm = (t?: string) => (t ? t.replace(':', 'h') : '');

function EventCard({ ev, onEdit }: { ev: CalendarEvent; onEdit: () => void }) {
  const { toggleDone, remove } = useCalendar.getState();
  const c = CATEGORIES[ev.category];
  return (
    <div className="group fade-up flex gap-3">
      <div className="w-14 shrink-0 pt-3 text-right">
        {ev.start ? (
          <>
            <p className="text-sm font-semibold text-slate-700">{hm(ev.start)}</p>
            {ev.end && <p className="text-xs text-slate-400">{hm(ev.end)}</p>}
          </>
        ) : (
          <p className="text-xs text-slate-400">Journée</p>
        )}
      </div>
      <div
        className={cx('flex flex-1 items-start gap-3 rounded-2xl border-l-4 p-3.5 transition', ev.done && 'opacity-55')}
        style={{ background: c.soft, borderColor: c.color }}
      >
        <button
          onClick={() => toggleDone(ev.id)}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white transition hover:scale-110"
          style={{ borderColor: c.color, background: ev.done ? c.color : undefined }}
          title={ev.done ? 'Marquer comme à faire' : "C'est fait !"}
        >
          {ev.done && <Check size={14} className="text-white" />}
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={onEdit}>
          <p className={cx('font-semibold text-slate-800', ev.done && 'line-through')}>
            {c.emoji} {ev.title}
          </p>
          <p className="mt-0.5 text-xs font-medium" style={{ color: c.text }}>
            {c.label}
            {ev.category === 'examen' && !ev.done && ` · ${countdownLabel(ev.date)}`}
          </p>
          {ev.details && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{ev.details}</p>}
        </button>
        <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button className="icon-btn" title="Modifier" onClick={onEdit}>
            <Pencil size={14} />
          </button>
          <button
            className="icon-btn hover:text-rose-600"
            title="Supprimer"
            onClick={() => {
              remove(ev.id);
              toast('Événement supprimé');
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const events = useCalendar(s => s.events);
  const [selected, setSelected] = useState(() => params.get('jour') ?? todayKey());
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [quick, setQuick] = useState('');
  const [hidden, setHidden] = useState<Set<EventCategory>>(new Set());
  const [form, setForm] = useState<{ event?: CalendarEvent; date: string } | null>(null);
  const quickRef = useRef<HTMLInputElement>(null);

  // Follow links like /calendrier?jour=2026-10-12 (from search, dashboard or Copilot).
  const jour = params.get('jour');
  const [lastJour, setLastJour] = useState(jour);
  if (jour !== lastJour) {
    setLastJour(jour);
    if (jour) setSelected(jour);
  }

  useEffect(() => {
    if (params.get('ajout')) {
      quickRef.current?.focus();
      setParams({});
    }
  }, [params, setParams]);

  const selectDay = (key: string) => {
    setSelected(key);
    if (jour) setParams({});
  };

  const visible = useMemo(() => events.filter(e => !hidden.has(e.category)), [events, hidden]);
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of [...visible].sort(sortEvents)) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [visible]);

  const selDate = fromKey(selected);
  const today = todayKey();
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart(selDate), i));
  const dayEvents = byDay.get(selected) ?? [];

  const parsed = quick.trim() ? parseQuickAdd(quick) : null;
  const parsedCat = parsed ? guessCategory(parsed.title || quick) : null;

  const submitQuick = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed?.title) return;
    const date = parsed.date ?? selected;
    useCalendar.getState().add({ title: parsed.title, date, start: parsed.start ?? undefined, end: parsed.end ?? undefined, category: parsedCat! });
    setQuick('');
    setSelected(date);
    toast(`Ajouté : ${parsed.title}`, 'success');
  };

  const shift = (dir: 1 | -1) => setSelected(toKey(mode === 'week' ? addDays(selDate, 7 * dir) : addMonths(selDate, dir)));

  const upcomingExams = events.filter(e => e.category === 'examen' && e.date >= today && !e.done).sort(sortEvents).slice(0, 4);
  const homework = events.filter(e => e.category === 'devoir' && !e.done && daysUntil(e.date) <= 14).sort(sortEvents).slice(0, 6);

  // Month grid (weeks start on Monday)
  const monthDays = useMemo(() => {
    const ref = fromKey(selected);
    const start = weekStart(startOfMonth(ref));
    const end = endOfMonth(ref);
    const days: Date[] = [];
    for (let d = start; d <= end || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
    return days;
  }, [selected]);

  return (
    <div className="h-full overflow-y-auto px-4 pb-10 pt-2 md:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="py-2 text-2xl font-bold tracking-tight">Calendrier</h1>

        {/* Quick add */}
        <form onSubmit={submitQuick} className="glass rounded-3xl p-2">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="ml-2.5 shrink-0 text-violet-500" />
            <input
              ref={quickRef}
              value={quick}
              onChange={e => setQuick(e.target.value)}
              placeholder="Écris simplement : « Exam de maths vendredi 14h », « Rendre TP demain », « Sport lundi 18h-19h »…"
              className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-[15px] outline-none placeholder:text-slate-400"
            />
            <button type="submit" disabled={!parsed?.title} className="btn-primary shrink-0">
              <CornerDownLeft size={15} /> <span className="hidden sm:inline">Ajouter</span>
            </button>
            <button type="button" className="icon-btn h-10 w-10 shrink-0" title="Formulaire détaillé" onClick={() => setForm({ date: selected })}>
              <Plus size={18} />
            </button>
          </div>
          {parsed?.title && (
            <div className="fade-up flex flex-wrap items-center gap-2 px-3 pb-1.5 pt-1 text-xs">
              <span className="text-slate-400">Je vais ajouter :</span>
              <span className="chip bg-slate-100 text-slate-700">{parsed.title}</span>
              <span className="chip bg-slate-100 capitalize text-slate-700">📅 {fmt(fromKey(parsed.date ?? selected), 'EEEE d MMM')}</span>
              {parsed.start && (
                <span className="chip bg-slate-100 text-slate-700">
                  <Clock size={11} /> {hm(parsed.start)}
                  {parsed.end && `–${hm(parsed.end)}`}
                </span>
              )}
              {parsedCat && (
                <span className="chip" style={{ background: CATEGORIES[parsedCat].soft, color: CATEGORIES[parsedCat].text }}>
                  {CATEGORIES[parsedCat].emoji} {CATEGORIES[parsedCat].label}
                </span>
              )}
            </div>
          )}
        </form>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <section className="glass rounded-[28px] p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <button className="icon-btn" onClick={() => shift(-1)} title="Précédent">
                <ChevronLeft size={18} />
              </button>
              <h2 className="min-w-36 text-center text-lg font-semibold capitalize">{fmt(selDate, 'MMMM yyyy')}</h2>
              <button className="icon-btn" onClick={() => shift(1)} title="Suivant">
                <ChevronRight size={18} />
              </button>
              <button className="btn-soft ml-1 py-1.5 text-xs" onClick={() => selectDay(today)}>
                Aujourd'hui
              </button>
              <div className="ml-auto flex rounded-xl bg-slate-100 p-1 text-xs font-medium">
                {(['week', 'month'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)} className={cx('rounded-lg px-3 py-1.5 transition', mode === m ? 'bg-white shadow-sm' : 'text-slate-500')}>
                    {m === 'week' ? 'Semaine' : 'Mois'}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'week' ? (
              <div className="mt-4 grid grid-cols-7 gap-1.5 md:gap-2">
                {week.map(d => {
                  const key = toKey(d);
                  const evs = byDay.get(key) ?? [];
                  const isSel = key === selected;
                  const isToday = key === today;
                  return (
                    <button
                      key={key}
                      onClick={() => selectDay(key)}
                      onDoubleClick={() => setForm({ date: key })}
                      className={cx(
                        'flex flex-col items-center rounded-2xl px-1 py-2.5 transition',
                        isSel ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'hover:bg-white/80',
                        !isSel && isToday && 'bg-indigo-50 text-indigo-700',
                      )}
                    >
                      <span className={cx('text-[11px] font-medium uppercase', isSel ? 'text-white/80' : 'text-slate-400')}>{fmt(d, 'EEE')}</span>
                      <span className="text-xl font-bold">{fmt(d, 'd')}</span>
                      <span className="mt-1 flex h-2 gap-0.5">
                        {evs.slice(0, 4).map(e => (
                          <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: isSel ? 'white' : CATEGORIES[e.category].color, opacity: e.done ? 0.4 : 1 }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4">
                <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-medium uppercase text-slate-400">
                  {['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map(d => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthDays.map(d => {
                    const key = toKey(d);
                    const evs = byDay.get(key) ?? [];
                    const isSel = key === selected;
                    return (
                      <button
                        key={key}
                        onClick={() => selectDay(key)}
                        onDoubleClick={() => setForm({ date: key })}
                        className={cx(
                          'flex min-h-16 flex-col items-stretch rounded-xl p-1 text-left transition md:min-h-20',
                          isSel ? 'bg-indigo-50 ring-2 ring-indigo-400' : 'hover:bg-white/80',
                          !isSameMonth(d, selDate) && 'opacity-35',
                        )}
                      >
                        <span className={cx('mb-0.5 flex h-6 w-6 items-center justify-center self-center rounded-full text-xs font-semibold md:self-start', key === today && 'bg-indigo-600 text-white')}>
                          {fmt(d, 'd')}
                        </span>
                        {evs.slice(0, 2).map(e => (
                          <span
                            key={e.id}
                            className="mb-0.5 hidden truncate rounded px-1 text-[10px] font-medium md:block"
                            style={{ background: CATEGORIES[e.category].soft, color: CATEGORIES[e.category].text, textDecoration: e.done ? 'line-through' : undefined }}
                          >
                            {e.title}
                          </span>
                        ))}
                        {evs.length > 0 && (
                          <span className="flex justify-center gap-0.5 md:hidden">
                            {evs.slice(0, 3).map(e => (
                              <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORIES[e.category].color }} />
                            ))}
                          </span>
                        )}
                        {evs.length > 2 && <span className="hidden text-[10px] text-slate-400 md:block">+{evs.length - 2}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selected day agenda */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="mb-4 flex items-center gap-2">
                <h3 className="text-lg font-semibold capitalize">{selected === today ? "Aujourd'hui" : fmt(selDate, 'EEEE d MMMM')}</h3>
                <span className="text-sm text-slate-400">
                  {dayEvents.length ? `${dayEvents.filter(e => e.done).length}/${dayEvents.length} fait` : ''}
                </span>
                <button className="btn-ghost ml-auto py-1.5 text-xs" onClick={() => setForm({ date: selected })}>
                  <Plus size={14} /> Ajouter
                </button>
              </div>
              {dayEvents.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <span className="text-4xl">🌤️</span>
                  <p className="mt-2 font-semibold text-slate-700">Journée libre</p>
                  <p className="text-sm text-slate-400">Rien de prévu. Utilise la barre du haut pour ajouter quelque chose.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dayEvents.map(ev => (
                    <EventCard key={ev.id} ev={ev} onEdit={() => setForm({ event: ev, date: ev.date })} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Focus column */}
          <aside className="space-y-5">
            <section className="glass rounded-[28px] p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">🎯 Examens à venir</h3>
              {upcomingExams.length === 0 ? (
                <p className="text-sm text-slate-400">Aucun examen prévu.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingExams.map(e => {
                    const n = daysUntil(e.date);
                    return (
                      <button key={e.id} onClick={() => selectDay(e.date)} className="flex w-full items-center gap-3 rounded-2xl bg-white/70 p-2.5 text-left transition hover:bg-white">
                        <span
                          className={cx(
                            'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl font-bold text-white',
                            n <= 3 ? 'bg-rose-500' : n <= 7 ? 'bg-amber-500' : 'bg-indigo-500',
                          )}
                        >
                          <span className="text-[10px] font-medium leading-none opacity-80">{n === 0 ? '' : 'J-'}</span>
                          <span className="text-base leading-none">{n === 0 ? 'Auj.' : n}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800">{e.title}</span>
                          <span className="block text-xs capitalize text-slate-400">
                            {fmt(fromKey(e.date), 'EEEE d MMM')}
                            {e.start && ` · ${hm(e.start)}`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="glass rounded-[28px] p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">✏️ À rendre bientôt</h3>
              {homework.length === 0 ? (
                <p className="text-sm text-slate-400">Rien à rendre, bravo 👏</p>
              ) : (
                <ul className="space-y-1.5">
                  {homework.map(e => (
                    <li key={e.id} className="flex items-center gap-2.5">
                      <button
                        onClick={() => useCalendar.getState().toggleDone(e.id)}
                        className="h-5 w-5 shrink-0 rounded-md border-2 border-amber-400 transition hover:bg-amber-100"
                        title="C'est fait !"
                      />
                      <button onClick={() => selectDay(e.date)} className="min-w-0 flex-1 truncate text-left text-sm text-slate-700 hover:text-indigo-600">
                        {e.title}
                      </button>
                      <span className={cx('text-xs font-medium', e.date < today ? 'text-rose-500' : 'text-slate-400')}>{countdownLabel(e.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="glass rounded-[28px] p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Afficher</h3>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORIES) as EventCategory[]).map(k => {
                  const c = CATEGORIES[k];
                  const off = hidden.has(k);
                  return (
                    <button
                      key={k}
                      onClick={() =>
                        setHidden(s => {
                          const n = new Set(s);
                          if (n.has(k)) n.delete(k);
                          else n.add(k);
                          return n;
                        })
                      }
                      className={cx('rounded-full px-3 py-1 text-xs font-semibold transition', off && 'opacity-40 line-through')}
                      style={{ background: c.soft, color: c.text }}
                    >
                      {c.emoji} {c.label}
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {form && <EventForm event={form.event} date={form.date} onClose={() => setForm(null)} />}
    </div>
  );
}
