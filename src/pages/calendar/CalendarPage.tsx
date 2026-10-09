import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, addMonths, endOfMonth, startOfMonth, isSameMonth } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, CornerDownLeft } from 'lucide-react';
import { useCalendar, CATEGORIES, guessCategory, sortEvents, type CalendarEvent, type EventCategory } from '../../store/calendar';
import { parseQuickAdd, toKey, fromKey, todayKey, fmt, weekStart, countdownLabel, daysUntil } from '../../lib/dates';
import { toast } from '../../store/ui';
import { cx } from '../../lib/utils';
import EventForm from './EventForm';

function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ background: color, width: size, height: size }} />;
}

function EventItem({ ev, onEdit }: { ev: CalendarEvent; onEdit: () => void }) {
  const { toggleDone, remove } = useCalendar.getState();
  const c = CATEGORIES[ev.category];
  return (
    <div className="group enter flex items-stretch gap-4">
      <div className="tabular w-12 shrink-0 pt-3 text-right text-[12px]">
        {ev.start ? (
          <>
            <p className="font-medium">{ev.start}</p>
            {ev.end && <p className="text-stone-400">{ev.end}</p>}
          </>
        ) : (
          <p className="text-stone-400">Journée</p>
        )}
      </div>
      <div className={cx('flex flex-1 items-start gap-3 rounded-lg border border-stone-200/80 bg-white py-3 pl-3 pr-2 transition-colors hover:border-stone-300', ev.done && 'bg-stone-50')}>
        <span className="mt-0.5 w-[3px] self-stretch rounded-full" style={{ background: c.color, opacity: ev.done ? 0.35 : 1 }} />
        <button
          onClick={() => toggleDone(ev.id)}
          className={cx('mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors', ev.done ? 'border-ink bg-ink' : 'border-stone-300 hover:border-stone-500')}
          title={ev.done ? 'Marquer comme à faire' : 'Marquer comme fait'}
        >
          {ev.done && <Check size={11} strokeWidth={3} className="text-white" />}
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={onEdit}>
          <p className={cx('text-[14px] font-medium leading-snug', ev.done && 'text-stone-400 line-through')}>{ev.title}</p>
          <p className="mt-0.5 text-[12px] text-stone-500">
            <span style={{ color: c.text }}>{c.label}</span>
            {ev.category === 'examen' && !ev.done && ` · ${countdownLabel(ev.date)}`}
          </p>
          {ev.details && <p className="mt-1.5 whitespace-pre-line text-[13px] text-stone-600">{ev.details}</p>}
        </button>
        <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
          <button className="icon-btn" title="Modifier" onClick={onEdit}>
            <Pencil size={14} />
          </button>
          <button
            className="icon-btn hover:text-red-600"
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h3 className="mb-3 text-[13px] font-medium text-stone-600">{title}</h3>
      {children}
    </section>
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

  const monthDays = useMemo(() => {
    const ref = fromKey(selected);
    const start = weekStart(startOfMonth(ref));
    const end = endOfMonth(ref);
    const days: Date[] = [];
    for (let d = start; d <= end || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
    return days;
  }, [selected]);

  return (
    <div className="h-full overflow-y-auto px-4 pb-12 md:px-8">
      <div className="mx-auto max-w-[1180px]">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 pb-4 pt-2">
          <h1 className="mr-3 text-[24px] font-semibold tracking-[-0.02em]">Calendrier</h1>
          <div className="ml-auto flex items-center gap-1">
            <button className="icon-btn" onClick={() => shift(-1)} title="Précédent">
              <ChevronLeft size={17} />
            </button>
            <span className="min-w-32 text-center text-[14px] font-medium capitalize">{fmt(selDate, 'MMMM yyyy')}</span>
            <button className="icon-btn" onClick={() => shift(1)} title="Suivant">
              <ChevronRight size={17} />
            </button>
          </div>
          <button className="btn-secondary h-8" onClick={() => selectDay(today)}>
            Aujourd'hui
          </button>
          <div className="flex h-8 items-center rounded-lg bg-stone-100 p-0.5 text-[13px]">
            {(['week', 'month'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} className={cx('h-7 rounded-md px-3 font-medium transition-colors', mode === m ? 'bg-white text-ink shadow-card' : 'text-stone-500 hover:text-ink')}>
                {m === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
        </div>

        {/* Quick add */}
        <form onSubmit={submitQuick} className="card flex flex-col px-3 transition-shadow focus-within:border-stone-300 focus-within:shadow-pop">
          <div className="flex h-12 items-center gap-2.5">
            <Plus size={17} className="shrink-0 text-stone-400" />
            <input
              ref={quickRef}
              value={quick}
              onChange={e => setQuick(e.target.value)}
              placeholder="Ajouter un événement, par exemple « Partiel de maths vendredi 14h »"
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-stone-400"
            />
            {parsed?.title ? (
              <button type="submit" className="btn-primary h-8 px-3">
                Ajouter <CornerDownLeft size={13} />
              </button>
            ) : (
              <button type="button" className="btn-ghost h-8 px-2.5 text-[12px]" onClick={() => setForm({ date: selected })}>
                Formulaire
              </button>
            )}
          </div>
          {parsed?.title && parsedCat && (
            <div className="enter flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-stone-100 py-2 pl-[27px] text-[12px] text-stone-500">
              <Dot color={CATEGORIES[parsedCat].color} />
              <span className="font-medium text-ink">{parsed.title}</span>
              <span>·</span>
              <span>{fmt(fromKey(parsed.date ?? selected), 'EEEE d MMMM')}</span>
              {parsed.start && (
                <>
                  <span>·</span>
                  <span className="tabular">
                    {parsed.start}
                    {parsed.end && `–${parsed.end}`}
                  </span>
                </>
              )}
              <span>·</span>
              <span style={{ color: CATEGORIES[parsedCat].text }}>{CATEGORIES[parsedCat].label}</span>
            </div>
          )}
        </form>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
          <section className="card p-4 md:p-5">
            {mode === 'week' ? (
              <div className="grid grid-cols-7 gap-1">
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
                      className={cx('flex flex-col items-center rounded-lg py-2.5 transition-colors', isSel ? 'bg-stone-100' : 'hover:bg-stone-50')}
                    >
                      <span className="text-[11px] font-medium capitalize text-stone-400">{fmt(d, 'EEE')}</span>
                      <span
                        className={cx(
                          'tabular mt-1 flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-semibold',
                          isSel ? 'bg-ink text-white' : isToday ? 'text-brand-600' : '',
                        )}
                      >
                        {fmt(d, 'd')}
                      </span>
                      <span className="mt-1.5 flex h-1.5 gap-[3px]">
                        {evs.slice(0, 4).map(e => (
                          <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORIES[e.category].color, opacity: e.done ? 0.3 : 1 }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-7 pb-1.5 text-center text-[11px] font-medium text-stone-400">
                  {['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map(d => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-stone-200 bg-stone-200 [gap:1px]">
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
                          'flex min-h-16 flex-col items-stretch p-1 text-left transition-colors md:min-h-[84px]',
                          isSel ? 'bg-stone-50' : 'bg-white hover:bg-stone-50',
                          !isSameMonth(d, selDate) && 'text-stone-300',
                        )}
                      >
                        <span
                          className={cx(
                            'tabular mb-0.5 flex h-6 w-6 items-center justify-center self-center rounded-full text-[12px] font-medium md:self-start',
                            isSel ? 'bg-ink text-white' : key === today && 'text-brand-600',
                          )}
                        >
                          {fmt(d, 'd')}
                        </span>
                        {evs.slice(0, 2).map(e => (
                          <span key={e.id} className="mb-0.5 hidden items-center gap-1 truncate rounded px-1 text-[11px] text-stone-700 md:flex" style={{ textDecoration: e.done ? 'line-through' : undefined }}>
                            <Dot color={CATEGORIES[e.category].color} size={6} />
                            <span className="truncate">{e.title}</span>
                          </span>
                        ))}
                        {evs.length > 0 && (
                          <span className="flex justify-center gap-0.5 md:hidden">
                            {evs.slice(0, 3).map(e => (
                              <Dot key={e.id} color={CATEGORIES[e.category].color} size={5} />
                            ))}
                          </span>
                        )}
                        {evs.length > 2 && <span className="hidden px-1 text-[10px] text-stone-400 md:block">+{evs.length - 2} autres</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selected day */}
            <div className="mt-5 border-t border-stone-100 pt-5">
              <div className="mb-4 flex items-baseline gap-2">
                <h2 className="text-[16px] font-semibold first-letter:uppercase">{selected === today ? "Aujourd'hui" : fmt(selDate, 'EEEE d MMMM')}</h2>
                {dayEvents.length > 0 && (
                  <span className="tabular text-[12px] text-stone-400">
                    {dayEvents.filter(e => e.done).length}/{dayEvents.length} terminé
                  </span>
                )}
                <button className="btn-ghost ml-auto h-8 text-[12px]" onClick={() => setForm({ date: selected })}>
                  <Plus size={14} /> Ajouter
                </button>
              </div>
              {dayEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stone-200 py-10 text-center">
                  <p className="text-[14px] font-medium">Journée libre</p>
                  <p className="mt-1 text-[13px] text-stone-500">Rien de prévu ce jour-là.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dayEvents.map(ev => (
                    <EventItem key={ev.id} ev={ev} onEdit={() => setForm({ event: ev, date: ev.date })} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <Panel title="Examens à venir">
              {upcomingExams.length === 0 ? (
                <p className="text-[13px] text-stone-400">Aucun examen prévu.</p>
              ) : (
                <ul className="-mx-1.5">
                  {upcomingExams.map(e => {
                    const n = daysUntil(e.date);
                    return (
                      <li key={e.id}>
                        <button onClick={() => selectDay(e.date)} className="flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-stone-50">
                          <span
                            className={cx(
                              'tabular flex h-9 w-11 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold',
                              n <= 3 ? 'bg-red-50 text-red-700' : n <= 7 ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-600',
                            )}
                          >
                            {n === 0 ? 'Auj.' : `J-${n}`}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium">{e.title}</span>
                            <span className="block text-[12px] first-letter:uppercase text-stone-500">
                              {fmt(fromKey(e.date), 'EEE d MMM')}
                              {e.start && ` · ${e.start}`}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="À rendre">
              {homework.length === 0 ? (
                <p className="text-[13px] text-stone-400">Rien à rendre pour l'instant.</p>
              ) : (
                <ul className="space-y-0.5">
                  {homework.map(e => (
                    <li key={e.id} className="flex h-8 items-center gap-2.5">
                      <button
                        onClick={() => useCalendar.getState().toggleDone(e.id)}
                        className="h-4 w-4 shrink-0 rounded border-[1.5px] border-stone-300 transition-colors hover:border-stone-500"
                        title="Marquer comme fait"
                      />
                      <button onClick={() => selectDay(e.date)} className="min-w-0 flex-1 truncate text-left text-[13px] hover:underline">
                        {e.title}
                      </button>
                      <span className={cx('tabular text-[12px]', e.date < today ? 'font-medium text-red-600' : 'text-stone-400')}>{countdownLabel(e.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Catégories">
              <div className="space-y-0.5">
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
                      className="flex h-8 w-full items-center gap-2.5 rounded-md px-1.5 text-[13px] transition-colors hover:bg-stone-50"
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded border-[1.5px]" style={{ borderColor: c.color, background: off ? 'transparent' : c.color }}>
                        {!off && <Check size={10} strokeWidth={3} className="text-white" />}
                      </span>
                      <span className={off ? 'text-stone-400' : ''}>{c.label}</span>
                      <span className="tabular ml-auto text-[12px] text-stone-400">{events.filter(e => e.category === k && e.date >= today).length}</span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </aside>
        </div>
      </div>

      {form && <EventForm event={form.event} date={form.date} onClose={() => setForm(null)} />}
    </div>
  );
}
