import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trashEvent } from '../../lib/trash';
import { addDays, addMonths, endOfMonth, startOfMonth, isSameMonth } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, CornerDownLeft, CalendarArrowDown } from 'lucide-react';
import { useCalendar, catOf, allCategories, guessCategory, sortEvents, type CalendarEvent, type EventCategory } from '../../store/calendar';
import { parseQuickAdd, toKey, fromKey, todayKey, fmt, weekStart, countdownLabel, daysUntil, toMinutes, fromMinutes } from '../../lib/dates';
import { toast } from '../../store/ui';
import { useSettings } from '../../store/settings';
import CategoriesDialog from './CategoriesDialog';
import { cx } from '../../lib/utils';
import EventForm from './EventForm';
import DayView from './DayView';
import ImportIcsDialog, { type IcsSource } from './ImportIcsDialog';
import { isIcsFile } from '../../lib/ics';
import { useEventDrag, type DropTarget } from './useEventDrag';

type Mode = 'week' | 'month' | 'day';
const MODES: { id: Mode; label: string }[] = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
];
const MODE_KEY = 'cop.calendar.mode';

function savedMode(): Mode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return m === 'day' || m === 'month' ? m : 'week';
  } catch {
    return 'week';
  }
}

function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ background: color, width: size, height: size }} />;
}

interface EventItemProps {
  ev: CalendarEvent;
  onEdit: () => void;
  dragging: boolean;
  onDragStart: (e: ReactPointerEvent<HTMLElement>) => void;
}

function EventItem({ ev, onEdit, dragging, onDragStart }: EventItemProps) {
  const { toggleDone } = useCalendar.getState();
  const c = catOf(ev.category);
  return (
    <div className="group enter flex items-stretch gap-4">
      <div className="tabular w-12 shrink-0 pt-3 text-right text-[12px]">
        {ev.start ? (
          <>
            <p className="font-medium">{ev.start}</p>
            {ev.end && <p className="text-stone-500">{ev.end}</p>}
          </>
        ) : (
          <p className="text-stone-500">Journée</p>
        )}
      </div>
      <div
        onPointerDown={onDragStart}
        title="Glisse sur un autre jour pour déplacer"
        className={cx('flex flex-1 touch-manipulation items-start gap-3 rounded-lg border border-stone-200/80 bg-surface py-3 pl-3 pr-2 transition-colors [-webkit-touch-callout:none] hover:border-stone-300', ev.done && 'bg-stone-50', dragging && 'opacity-40')}
      >
        <span className="mt-0.5 w-[3px] self-stretch rounded-full" style={{ background: c.color, opacity: ev.done ? 0.35 : 1 }} />
        <button
          onClick={() => toggleDone(ev.id)}
          className={cx('mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors', ev.done ? 'border-ink bg-ink' : 'border-stone-300 hover:border-stone-500')}
          title={ev.done ? 'Marquer comme à faire' : 'Marquer comme fait'} aria-label={ev.done ? 'Marquer comme à faire' : 'Marquer comme fait'}
        >
          {ev.done && <Check size={11} strokeWidth={3} className="text-paper" />}
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={onEdit}>
          <p className={cx('text-[14px] font-medium leading-snug', ev.done && 'text-stone-500 line-through')}>{ev.title}</p>
          <p className="mt-0.5 text-[12px] text-stone-500">
            <span style={{ color: c.text }}>{c.label}</span>
            {ev.category === 'examen' && !ev.done && ` · ${countdownLabel(ev.date)}`}
          </p>
          {ev.details && <p className="mt-1.5 whitespace-pre-line text-[13px] text-stone-600">{ev.details}</p>}
        </button>
        <div className="touch-show flex opacity-0 transition-opacity group-hover:opacity-100">
          <button className="icon-btn" title="Modifier" aria-label="Modifier" onClick={onEdit}>
            <Pencil size={14} />
          </button>
          <button
            className="icon-btn hover:text-red-600"
            title="Supprimer" aria-label="Supprimer"
            onClick={() => trashEvent(ev.id)}
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
  const [mode, setModeState] = useState<Mode>(savedMode);
  const [quick, setQuick] = useState('');
  const [hidden, setHidden] = useState<Set<EventCategory>>(new Set());
  const custom = useSettings(s => s.customCategories);
  const [managing, setManaging] = useState(false);
  const [form, setForm] = useState<{ event?: CalendarEvent; date: string; start?: string; end?: string } | null>(null);
  const [importing, setImporting] = useState<{ initial?: IcsSource } | null>(null);
  const [fileOver, setFileOver] = useState(false);
  const quickRef = useRef<HTMLInputElement>(null);

  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  };

  // Follow links like /calendrier?jour=2026-10-12 (from search, dashboard or Kompaly).
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

  const shift = (dir: 1 | -1) => selectDay(toKey(mode === 'day' ? addDays(selDate, dir) : mode === 'week' ? addDays(selDate, 7 * dir) : addMonths(selDate, dir)));

  // ← / → move one day (↑ / ↓ one week outside the day view), like a desktop agenda.
  const keysRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    keysRef.current = e => {
      if (form || importing || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [aria-modal="true"]')) return;
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: mode === 'day' ? 0 : -7, ArrowDown: mode === 'day' ? 0 : 7 }[e.key];
      if (!delta) return;
      e.preventDefault();
      selectDay(toKey(addDays(selDate, delta)));
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keysRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Drag an event onto another day, or onto another time in the day view.
  const moveEvent = (ev: CalendarEvent, target: DropTarget) => {
    const patch: Partial<CalendarEvent> = { date: target.day };
    if (target.minutes !== undefined) {
      const length = ev.start && ev.end ? toMinutes(ev.end) - toMinutes(ev.start) : ev.start ? null : 60;
      patch.start = fromMinutes(target.minutes);
      patch.end = length === null ? undefined : fromMinutes(target.minutes + length);
    }
    const dayChanged = patch.date !== ev.date;
    const timeChanged = patch.start !== undefined && patch.start !== ev.start;
    if (!dayChanged && !timeChanged) return;
    const before = { date: ev.date, start: ev.start, end: ev.end };
    const { update } = useCalendar.getState();
    update(ev.id, patch);
    const label = dayChanged ? `Déplacé au ${fmt(fromKey(target.day), 'EEEE d MMM')}${timeChanged ? ` à ${patch.start}` : ''}` : `Déplacé à ${patch.start}`;
    toast(label, 'success', { label: 'Annuler', run: () => update(ev.id, before) });
  };
  const { drag, ghostRef, start: startDrag } = useEventDrag(moveEvent);
  const dropDay = drag?.target && drag.target.minutes === undefined ? drag.target.day : null;

  // Drop an .ics file anywhere on the page to import it.
  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');
  const onFileDrop = async (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setFileOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!isIcsFile(file)) {
      toast('Dépose un fichier .ics pour importer un emploi du temps', 'error');
      return;
    }
    setImporting({ initial: { name: file.name, text: await file.text() } });
  };

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
    <div
      className="h-full overflow-y-auto px-4 pb-12 md:px-8"
      onDragOver={e => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        if (!fileOver) setFileOver(true);
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileOver(false);
      }}
      onDrop={e => void onFileDrop(e)}
    >
      <div className="mx-auto max-w-[1180px]">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 pb-4 pt-2">
          <h1 className="mr-3 text-[24px] font-semibold tracking-[-0.02em]">Calendrier</h1>
          <div className="ml-auto flex items-center gap-1">
            <button className="icon-btn" onClick={() => shift(-1)} title={mode === 'day' ? 'Jour précédent' : 'Précédent'} aria-label={mode === 'day' ? 'Jour précédent' : 'Précédent'}>
              <ChevronLeft size={17} />
            </button>
            <span className="min-w-32 text-center text-[14px] font-medium first-letter:uppercase">{fmt(selDate, mode === 'day' ? 'EEE d MMMM' : 'MMMM yyyy')}</span>
            <button className="icon-btn" onClick={() => shift(1)} title={mode === 'day' ? 'Jour suivant' : 'Suivant'} aria-label={mode === 'day' ? 'Jour suivant' : 'Suivant'}>
              <ChevronRight size={17} />
            </button>
          </div>
          <button className="btn-secondary h-8" onClick={() => selectDay(today)}>
            Aujourd'hui
          </button>
          <div className="flex h-8 items-center rounded-lg bg-stone-100 p-0.5 text-[13px]" role="group" aria-label="Affichage">
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} aria-pressed={mode === m.id} className={cx('h-7 rounded-md px-3 font-medium transition-colors', mode === m.id ? 'bg-surface text-ink shadow-card' : 'text-stone-500 hover:text-ink')}>
                {m.label}
              </button>
            ))}
          </div>
          <button className="icon-btn h-8 w-8" onClick={() => setImporting({})} title="Importer un emploi du temps (.ics)" aria-label="Importer un emploi du temps (.ics)">
            <CalendarArrowDown size={16} />
          </button>
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
              aria-label="Ajouter un événement en une phrase"
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
              <Dot color={catOf(parsedCat).color} />
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
              <span style={{ color: catOf(parsedCat).text }}>{catOf(parsedCat).label}</span>
            </div>
          )}
        </form>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1fr_300px]">
          <section className="card p-4 md:p-5">
            {mode !== 'month' ? (
              <div className="grid grid-cols-7 gap-1">
                {week.map(d => {
                  const key = toKey(d);
                  const evs = byDay.get(key) ?? [];
                  const isSel = key === selected;
                  const isToday = key === today;
                  return (
                    <button
                      key={key}
                      data-drop-day={key}
                      onClick={() => selectDay(key)}
                      onDoubleClick={() => setForm({ date: key })}
                      className={cx(
                        'flex flex-col items-center rounded-lg py-2.5 transition-colors',
                        dropDay === key ? 'bg-brand-50 ring-2 ring-brand-500/40' : isSel ? 'bg-stone-100' : 'hover:bg-stone-50',
                        drag && dropDay !== key && 'ring-1 ring-stone-200 ring-inset',
                      )}
                    >
                      <span className="text-[11px] font-medium capitalize text-stone-500">{fmt(d, 'EEE')}</span>
                      <span
                        className={cx(
                          'tabular mt-1 flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-semibold',
                          isSel ? 'bg-ink text-paper' : isToday ? 'text-brand-600' : '',
                        )}
                      >
                        {fmt(d, 'd')}
                      </span>
                      <span className="mt-1.5 flex h-1.5 gap-[3px]">
                        {evs.slice(0, 4).map(e => (
                          <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: catOf(e.category).color, opacity: e.done ? 0.3 : 1 }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-7 pb-1.5 text-center text-[11px] font-medium text-stone-500">
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
                        data-drop-day={key}
                        onClick={() => selectDay(key)}
                        onDoubleClick={() => setForm({ date: key })}
                        className={cx(
                          'flex min-h-16 flex-col items-stretch p-1 text-left transition-colors md:min-h-[84px]',
                          dropDay === key ? 'bg-brand-50 shadow-[inset_0_0_0_2px_var(--color-brand-200)]' : isSel ? 'bg-stone-50' : 'bg-surface hover:bg-stone-50',
                          !isSameMonth(d, selDate) && 'text-stone-500',
                        )}
                      >
                        <span
                          className={cx(
                            'tabular mb-0.5 flex h-6 w-6 items-center justify-center self-center rounded-full text-[12px] font-medium md:self-start',
                            isSel ? 'bg-ink text-paper' : key === today && 'text-brand-600',
                          )}
                        >
                          {fmt(d, 'd')}
                        </span>
                        {evs.slice(0, 2).map(e => (
                          <span
                            key={e.id}
                            onPointerDown={p => startDrag(e, p)}
                            className={cx('mb-0.5 hidden cursor-grab select-none items-center gap-1 truncate rounded px-1 text-[11px] text-stone-700 hover:bg-stone-100 md:flex', drag?.ev.id === e.id && 'opacity-40')}
                            style={{ textDecoration: e.done ? 'line-through' : undefined }}
                          >
                            <Dot color={catOf(e.category).color} size={6} />
                            <span className="truncate">{e.title}</span>
                          </span>
                        ))}
                        {evs.length > 0 && (
                          <span className="flex justify-center gap-0.5 md:hidden">
                            {evs.slice(0, 3).map(e => (
                              <Dot key={e.id} color={catOf(e.category).color} size={5} />
                            ))}
                          </span>
                        )}
                        {evs.length > 2 && <span className="hidden px-1 text-[10px] text-stone-500 md:block">+{evs.length - 2} autres</span>}
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
                <button className="btn-ghost ml-auto h-8 text-[12px]" onClick={() => setForm({ date: selected })}>
                  <Plus size={14} /> Ajouter
                </button>
              </div>
              {mode === 'day' ? (
                <DayView
                  date={selected}
                  isToday={selected === today}
                  events={dayEvents}
                  drag={drag}
                  onDragStart={startDrag}
                  onEdit={ev => setForm({ event: ev, date: ev.date })}
                  onCreate={(start, end) => setForm({ date: selected, start, end })}
                />
              ) : dayEvents.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-stone-500">Rien de prévu ce jour-là.</p>
              ) : (
                <div className="space-y-2">
                  {dayEvents.map(ev => (
                    <EventItem key={ev.id} ev={ev} dragging={drag?.ev.id === ev.id} onDragStart={e => startDrag(ev, e)} onEdit={() => setForm({ event: ev, date: ev.date })} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside aria-labelledby="a-venir-titre" className="card self-start p-4">
            <h2 id="a-venir-titre" className="mb-2 text-[13px] font-medium text-stone-600">
              À venir
            </h2>
            {upcomingExams.length === 0 && homework.length === 0 ? (
              <p className="py-1 text-[13px] text-stone-500">Aucun examen ni rendu prévu.</p>
            ) : (
              <ul className="-mx-1.5">
                {upcomingExams.map(e => {
                  const n = daysUntil(e.date);
                  return (
                    <li key={e.id}>
                      <button onClick={() => selectDay(e.date)} className="flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-stone-50">
                        <span className={cx('tabular w-9 shrink-0 text-[13px] font-semibold', n <= 3 ? 'text-[var(--cat-examen-text)]' : 'text-ink')}>{n === 0 ? 'Auj.' : `J-${n}`}</span>
                        <span className="min-w-0 flex-1">
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
                {homework.map(e => (
                  <li key={e.id} className="flex h-8 items-center gap-3 px-1.5">
                    <span className="flex w-9 shrink-0">
                      <button
                        onClick={() => useCalendar.getState().toggleDone(e.id)}
                        className="h-4 w-4 rounded border-[1.5px] border-stone-300 transition-colors hover:border-stone-500"
                        title="Marquer comme rendu"
                        aria-label={`Marquer « ${e.title} » comme rendu`}
                      />
                    </span>
                    <button onClick={() => selectDay(e.date)} className="min-w-0 flex-1 truncate text-left text-[13px] hover:underline">
                      {e.title}
                    </button>
                    <span className={cx('tabular shrink-0 text-[12px]', e.date < today ? 'font-medium text-[var(--cat-examen-text)]' : 'text-stone-500')}>{countdownLabel(e.date)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-stone-100 pt-3" role="group" aria-label="Catégories affichées">
              {allCategories(custom).map(k => {
                const c = catOf(k);
                const off = hidden.has(k);
                return (
                  <button
                    key={k}
                    aria-pressed={!off}
                    title={off ? `Afficher : ${c.label}` : `Masquer : ${c.label}`}
                    onClick={() =>
                      setHidden(s => {
                        const n = new Set(s);
                        if (n.has(k)) n.delete(k);
                        else n.add(k);
                        return n;
                      })
                    }
                    className={cx('flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors', off ? 'border-dashed border-stone-200 text-stone-500 hover:text-ink' : 'border-stone-200 bg-surface text-ink hover:bg-stone-50')}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full border-[1.5px]" style={{ borderColor: c.color, background: off ? 'transparent' : c.color }} />
                    {c.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setManaging(true)}
                className="flex h-7 items-center gap-1 rounded-full border border-dashed border-stone-300 px-2.5 text-[12px] text-stone-500 transition-colors hover:border-stone-400 hover:text-ink"
              >
                <Plus size={13} /> Catégorie
              </button>
            </div>
          </aside>
        </div>
      </div>

      {form && <EventForm event={form.event} date={form.date} start={form.start} end={form.end} onClose={() => setForm(null)} />}
      {importing && <ImportIcsDialog initial={importing.initial} onClose={() => setImporting(null)} onImported={selectDay} />}
      {managing && <CategoriesDialog onClose={() => setManaging(false)} />}

      {/* Chip that follows the pointer while an event is dragged */}
      {drag && (
        <div
          ref={ghostRef}
          className={cx(
            'pointer-events-none fixed left-0 top-0 z-[80] flex max-w-56 items-center gap-1.5 rounded-md border border-stone-200 bg-surface px-2 py-1 text-[12px] font-medium shadow-pop transition-opacity',
            // Over the hourly grid the dashed preview already shows where it lands.
            drag.target?.minutes !== undefined && 'opacity-0',
          )}
        >
          <Dot color={catOf(drag.ev.category).color} size={7} />
          <span className="truncate">{drag.ev.title}</span>
        </div>
      )}

      {fileOver && (
        <div className="pointer-events-none fixed inset-0 z-[75] flex items-center justify-center bg-stone-900/10 p-6">
          <div className="pop flex flex-col items-center rounded-2xl border-2 border-dashed border-brand-500 bg-surface/95 px-10 py-8 text-center shadow-pop">
            <CalendarArrowDown size={26} className="text-brand-600" />
            <p className="mt-2 text-[15px] font-semibold">Dépose ton emploi du temps</p>
            <p className="mt-0.5 text-[13px] text-stone-500">Fichier .ics exporté depuis ton ENT ou Google Agenda</p>
          </div>
        </div>
      )}
    </div>
  );
}
