import { useMemo, useRef, useState } from 'react';
import { CalendarArrowDown, FileUp } from 'lucide-react';
import { Modal } from '../../components/Overlays';
import { CATEGORIES, guessCategory, useCalendar, type EventCategory, type NewEvent } from '../../store/calendar';
import { isIcsFile, parseIcs, type IcsEvent } from '../../lib/ics';
import { fmt, fromKey, todayKey } from '../../lib/dates';
import { toast } from '../../store/ui';
import { cx } from '../../lib/utils';

export interface IcsSource {
  name: string;
  text: string;
}

/** In a timetable, a TD or TP slot is a class, not homework. */
function categoryOf(e: IcsEvent): EventCategory {
  const c = guessCategory(e.title);
  return c === 'devoir' && e.start && /\b(td|tp|cm)\b/i.test(e.title) ? 'cours' : c;
}

interface Props {
  initial?: IcsSource;
  onClose: () => void;
  /** Called with the first imported day so the calendar can jump to it. */
  onImported: (firstDate: string) => void;
}

export default function ImportIcsDialog({ initial, onClose, onImported }: Props) {
  const [source, setSource] = useState<IcsSource | undefined>(initial);
  const [skipPast, setSkipPast] = useState(true);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const events = useCalendar(s => s.events);
  const today = todayKey();

  const parsed = useMemo(() => {
    if (!source) return null;
    try {
      return parseIcs(source.text);
    } catch {
      return [];
    }
  }, [source]);

  const plan = useMemo(() => {
    if (!parsed) return null;
    const known = new Set(events.map(e => e.externalId).filter(Boolean));
    const ids = new Set(events.map(e => e.id));
    // Also recognise events exported from COP-PILOT itself (UID "<id>@cop-pilot").
    const dup = (e: IcsEvent) => known.has(e.externalId) || ids.has(e.externalId.replace(/@cop-pilot(_\d{8})?$/, ''));
    const fresh = parsed.filter(e => !dup(e));
    const todo = fresh.filter(e => !skipPast || e.date >= today);
    const cats = new Map<EventCategory, number>();
    for (const e of todo) cats.set(categoryOf(e), (cats.get(categoryOf(e)) ?? 0) + 1);
    return { todo, duplicates: parsed.length - fresh.length, past: fresh.filter(e => e.date < today).length, cats };
  }, [parsed, events, skipPast, today]);

  const read = async (file: File | undefined) => {
    if (!file) return;
    if (!isIcsFile(file)) {
      toast('Choisis un fichier .ics', 'error');
      return;
    }
    setSource({ name: file.name, text: await file.text() });
  };

  const submit = () => {
    if (!plan?.todo.length) return;
    const list: NewEvent[] = plan.todo.map(e => ({ title: e.title, date: e.date, start: e.start, end: e.end, details: e.details, externalId: e.externalId, category: categoryOf(e) }));
    useCalendar.getState().addMany(list);
    const n = list.length;
    toast(`${n} événement${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''}${plan.duplicates ? ` · ${plan.duplicates} déjà présent${plan.duplicates > 1 ? 's' : ''}` : ''}`, 'success');
    onImported(list.find(e => e.date >= today)?.date ?? list[0].date);
    onClose();
  };

  const range = plan?.todo.length ? [plan.todo[0].date, plan.todo[plan.todo.length - 1].date] : null;
  const sample = plan?.todo.slice(0, 6) ?? [];

  return (
    <Modal open onClose={onClose} width={500}>
      <h3 className="text-[15px] font-semibold">Importer un emploi du temps</h3>

      {!source ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={e => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={e => {
              e.preventDefault();
              e.stopPropagation();
              setOver(false);
              void read(e.dataTransfer.files[0]);
            }}
            className={cx('mt-4 flex w-full flex-col items-center rounded-xl border-[1.5px] border-dashed px-4 py-8 text-center transition-colors', over ? 'border-brand-500 bg-brand-50' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50')}
          >
            <FileUp size={22} className="text-stone-400" />
            <span className="mt-2 text-[14px] font-medium">Choisir un fichier .ics</span>
            <span className="mt-0.5 text-[12px] text-stone-500">ou glisse-le ici</span>
          </button>
          <input ref={inputRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={e => void read(e.target.files?.[0])} />

          <div className="mt-4 space-y-2.5 text-[13px] text-stone-600">
            <p className="eyebrow">Où trouver ce fichier ?</p>
            <p>
              <span className="font-medium text-ink">ENT de ta fac ou de ton école</span> : ouvre ton emploi du temps (ADE, Hyperplanning…), puis cherche
              «&nbsp;Exporter&nbsp;», «&nbsp;Synchroniser&nbsp;» ou «&nbsp;Export iCal&nbsp;» et télécharge le fichier <span className="font-mono text-[12px]">.ics</span>.
            </p>
            <p>
              <span className="font-medium text-ink">Google Agenda</span> : Paramètres › Importer et exporter › Exporter, puis décompresse le .zip reçu.
            </p>
            <p className="text-[12px] text-stone-500">Les liens d'abonnement (URL) ne peuvent pas être lus directement : télécharge le fichier.</p>
          </div>

          <div className="mt-5 flex justify-end">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Annuler
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 truncate text-[12px] text-stone-500">{source.name}</p>

          {!parsed?.length ? (
            <div className="mt-4 rounded-lg border border-dashed border-stone-200 py-8 text-center">
              <p className="text-[14px] font-medium">Aucun événement trouvé</p>
              <p className="mt-1 text-[13px] text-stone-500">Ce fichier ne contient pas d'événement lisible.</p>
            </div>
          ) : (
            plan && (
              <>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="tabular text-[28px] font-semibold leading-none tracking-[-0.02em]">{plan.todo.length}</span>
                  <span className="text-[13px] text-stone-600">
                    événement{plan.todo.length > 1 ? 's' : ''} à importer
                    {range && (
                      <>
                        {' '}
                        · du {fmt(fromKey(range[0]), 'd MMM')} au {fmt(fromKey(range[1]), 'd MMM yyyy')}
                      </>
                    )}
                  </span>
                </div>

                {plan.cats.size > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-stone-500">
                    {[...plan.cats].map(([k, n]) => (
                      <span key={k} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: CATEGORIES[k].color }} />
                        {CATEGORIES[k].label} <span className="tabular">{n}</span>
                      </span>
                    ))}
                  </div>
                )}

                {sample.length > 0 && (
                  <ul className="mt-4 divide-y divide-stone-100 rounded-lg border border-stone-200">
                    {sample.map(e => (
                      <li key={e.externalId} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                        <span className="w-20 shrink-0 text-[12px] text-stone-500 first-letter:uppercase">{fmt(fromKey(e.date), 'EEE d MMM')}</span>
                        <span className="tabular w-11 shrink-0 text-[12px] text-stone-500">{e.start ?? 'Journée'}</span>
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORIES[categoryOf(e)].color }} />
                        <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                      </li>
                    ))}
                    {plan.todo.length > sample.length && <li className="px-3 py-2 text-[12px] text-stone-500">et {plan.todo.length - sample.length} autres…</li>}
                  </ul>
                )}

                <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[13px]">
                  <input type="checkbox" checked={skipPast} onChange={e => setSkipPast(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
                  Ignorer les événements passés
                  {plan.past > 0 && <span className="tabular text-stone-500">({plan.past})</span>}
                </label>
                {plan.duplicates > 0 && (
                  <p className="mt-2 text-[12px] text-stone-500">
                    {plan.duplicates} événement{plan.duplicates > 1 ? 's' : ''} déjà dans ton calendrier ne {plan.duplicates > 1 ? 'seront' : 'sera'} pas ajouté{plan.duplicates > 1 ? 's' : ''} en double.
                  </p>
                )}
              </>
            )
          )}

          <div className="mt-5 flex items-center gap-2">
            <button type="button" className="btn-ghost" onClick={() => setSource(undefined)}>
              Autre fichier
            </button>
            <button type="button" className="btn-secondary ml-auto" onClick={onClose}>
              Annuler
            </button>
            <button type="button" className="btn-primary" disabled={!plan?.todo.length} onClick={submit}>
              <CalendarArrowDown size={15} /> Importer
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
