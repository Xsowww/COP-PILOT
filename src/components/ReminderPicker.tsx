import { useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { anchorOf, MAX_MINUTES, minutesBefore, reminderLabel, reminderMoment } from '../lib/reminders';
import { deviceState, enableDevice } from '../lib/push';
import { devicePushChanged } from '../lib/reminderScheduler';
import { toast } from '../store/ui';
import { cx } from '../lib/utils';

interface Props {
  value: number[];
  onChange: (v: number[]) => void;
  /** The item has a time (else the reminders count from 9:00 that day). */
  timed: boolean;
  /** The item's day and time (YYYY-MM-DD, HH:mm): custom reminders at a chosen date and time. */
  date?: string;
  time?: string;
  /** No date yet: reminders need one. */
  disabled?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const UNITS = { min: 1, h: 60, j: 1440 } as const;
type Unit = keyof typeof UNITS;

interface Custom {
  mode: 'moment' | 'duree';
  day: string;
  at: string;
  amount: string;
  unit: Unit;
}

/** The custom reminder being typed: its minutes before the item, or why it can't be added. */
function customMinutes(c: Custom, date: string | undefined, time: string | undefined, taken: number[]): { minutes?: number; error?: string } {
  let minutes: number;
  if (c.mode === 'duree') {
    const n = Number(c.amount.replace(',', '.'));
    if (!c.amount.trim() || !Number.isFinite(n) || n < 0) return { error: 'Indique une durée.' };
    minutes = Math.round(n * UNITS[c.unit]);
  } else {
    if (!date || !c.day || !/^\d{2}:\d{2}$/.test(c.at)) return { error: 'Indique un jour et une heure.' };
    minutes = minutesBefore(date, time, c.day, c.at);
    if (minutes < 0) return { error: time ? 'C’est après le début : choisis un moment avant.' : 'C’est après 9 h le jour même : choisis un moment avant.' };
  }
  if (minutes > MAX_MINUTES) return { error: '4 semaines avant au plus.' };
  if (taken.includes(minutes)) return { error: 'Ce rappel est déjà dans la liste.' };
  if (date && reminderMoment(date, time, minutes).getTime() < Date.now()) return { minutes, error: 'Ce moment est déjà passé.' };
  return { minutes };
}

/** « Rappels » : one or several moments before an event or a task (lib/reminders). */
export default function ReminderPicker({ value, onChange, timed, date, time, disabled }: Props) {
  const [state, setState] = useState(deviceState);
  const [custom, setCustom] = useState<Custom | null>(null);
  const check = custom ? customMinutes(custom, date, time, value) : null;
  const openCustom = () => {
    // Starts one hour before (or at 8:00 the same day for an item without a time).
    const start = date ? new Date(anchorOf(date, time).getTime() - 60 * 60_000) : null;
    setCustom({ mode: date ? 'moment' : 'duree', day: start ? dayKey(start) : '', at: start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : '', amount: '1', unit: 'h' });
  };
  const addCustom = () => {
    if (check?.minutes === undefined || check.error) return;
    onChange([...value, check.minutes]);
    setCustom(null);
  };
  // The day before at 9:00 and at 18:00 (minutes before the item, worked out from its day and time), then « Personnalisé… ».
  const left = date
    ? [9, 18]
        .map(h => ({ minutes: minutesBefore(date, time, date, `${pad(h)}:00`) + 1440, label: `La veille à ${h}h` }))
        .filter(o => !value.includes(o.minutes))
    : [];
  const sorted = [...value].sort((a, b) => a - b);

  const turnOn = async () => {
    const next = await enableDevice();
    setState(next);
    if (next === 'on') {
      void devicePushChanged();
      toast('Notifications activées sur cet appareil', 'success');
    } else if (next === 'denied') toast('Notifications bloquées : autorise-les dans les réglages du site de ton navigateur.', 'error');
  };

  return (
    <div className="mt-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-stone-600">
        <Bell size={13} aria-hidden /> Rappels
      </p>
      {disabled ? (
        <p className="text-[12.5px] text-stone-500">{disabled}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {sorted.map(m => (
            <span key={m} className="flex h-8 items-center gap-1 rounded-md border border-brand-200 bg-brand-50 pl-2.5 pr-1 text-[13px] font-medium text-brand-700 pointer-coarse:h-9">
              {reminderLabel(m, timed, date, time)}
              <button
                type="button"
                onClick={() => onChange(value.filter(x => x !== m))}
                className="flex h-6 w-6 items-center justify-center rounded text-brand-600 transition-colors hover:bg-brand-100"
                aria-label={`Retirer le rappel « ${reminderLabel(m, timed, date, time)} »`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          {!value.length && <span className="mr-1 text-[13px] text-stone-500">Aucun</span>}
          {value.length < 10 && !custom && (
            <select
              value=""
              onChange={e => {
                if (e.target.value === 'perso') openCustom();
                else if (e.target.value !== '') onChange([...value, Number(e.target.value)]);
              }}
              aria-label="Ajouter un rappel"
              className="field h-8 w-auto pr-7 text-[13px] text-stone-600 pointer-coarse:h-9"
            >
              <option value="">+ Ajouter un rappel</option>
              {left.map(o => (
                <option key={o.minutes} value={o.minutes}>
                  {o.label}
                </option>
              ))}
              <option value="perso">Personnalisé…</option>
            </select>
          )}
        </div>
      )}
      {!disabled && custom && (
        <div
          className="mt-2 rounded-lg border border-stone-200 bg-stone-50 p-3"
          role="group"
          aria-label="Rappel personnalisé"
          // Enter in its fields adds the reminder (and doesn't send the event's form).
          onKeyDown={e => {
            if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return;
            e.preventDefault();
            addCustom();
          }}
        >
          {date && (
            <div className="mb-2.5 flex gap-1 rounded-lg bg-stone-100 p-0.5 text-[12.5px] font-medium">
              {(
                [
                  ['moment', 'Jour et heure'],
                  ['duree', 'Durée avant'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={custom.mode === mode}
                  onClick={() => setCustom({ ...custom, mode })}
                  className={cx('h-7 flex-1 rounded-md px-2 transition-colors', custom.mode === mode ? 'bg-surface text-ink shadow-card' : 'text-stone-600 hover:text-ink')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {custom.mode === 'moment' ? (
            <div className="flex flex-wrap gap-2">
              <input type="date" value={custom.day} max={date} onChange={e => setCustom({ ...custom, day: e.target.value })} aria-label="Jour du rappel" className="field h-8 min-w-0 flex-1" />
              <input type="time" value={custom.at} onChange={e => setCustom({ ...custom, at: e.target.value })} aria-label="Heure du rappel" className="field h-8 w-[118px]" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                // Text, not number: « 3,5 » with a comma is refused by some browsers' number fields.
                type="text"
                inputMode="decimal"
                value={custom.amount}
                onChange={e => setCustom({ ...custom, amount: e.target.value })}
                aria-label="Durée"
                className="field h-8 w-20"
              />
              <select value={custom.unit} onChange={e => setCustom({ ...custom, unit: e.target.value as Unit })} aria-label="Unité" className="field h-8 w-auto pr-7">
                <option value="min">minutes</option>
                <option value="h">heures</option>
                <option value="j">jours</option>
              </select>
              <span className="text-[13px] text-stone-600">avant</span>
            </div>
          )}
          <p className={cx('mt-2 text-[12px]', check?.error ? 'text-red-600' : 'text-stone-600')} aria-live="polite">
            {check?.error ?? (check?.minutes !== undefined && date ? `Rappel : ${reminderLabel(check.minutes, timed, date, time).replace(/^./, c => c.toLowerCase())}` : '')}
          </p>
          <div className="mt-2.5 flex justify-end gap-2">
            <button type="button" className="btn-secondary h-8 px-3 text-[13px]" onClick={() => setCustom(null)}>
              Annuler
            </button>
            <button type="button" className="btn-primary h-8 px-3 text-[13px]" disabled={check?.minutes === undefined || !!check.error} onClick={addCustom}>
              Ajouter
            </button>
          </div>
        </div>
      )}
      {!disabled && value.length > 0 && state !== 'on' && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-stone-50 px-2.5 py-2 text-[12px] text-stone-600">
          <BellOff size={13} className="shrink-0 text-stone-400" aria-hidden />
          {state === 'off' ? (
            <>
              <span>Sur cet appareil, tu ne seras prévenu que si Kompaly est ouvert.</span>
              <button type="button" onClick={() => void turnOn()} className="font-medium text-brand-600 underline-offset-2 hover:underline">
                Activer les notifications
              </button>
            </>
          ) : state === 'install' ? (
            <span>Sur iPhone, ajoute Kompaly à l’écran d’accueil (Partager › Sur l’écran d’accueil) pour recevoir les notifications.</span>
          ) : state === 'denied' ? (
            <span>Notifications bloquées sur cet appareil : autorise-les dans les réglages du site de ton navigateur.</span>
          ) : (
            <span>Ce navigateur n’affiche pas de notifications : le rappel apparaîtra dans Kompaly quand il est ouvert.</span>
          )}
        </p>
      )}
    </div>
  );
}
