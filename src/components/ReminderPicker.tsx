import { useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { reminderLabel, reminderOptions } from '../lib/reminders';
import { deviceState, enableDevice } from '../lib/push';
import { devicePushChanged } from '../lib/reminderScheduler';
import { toast } from '../store/ui';

interface Props {
  value: number[];
  onChange: (v: number[]) => void;
  /** The item has a time (else the reminders count from 9:00 that day). */
  timed: boolean;
  /** No date yet: reminders need one. */
  disabled?: string;
}

/** « Rappels » : one or several moments before an event or a task (lib/reminders). */
export default function ReminderPicker({ value, onChange, timed, disabled }: Props) {
  const [state, setState] = useState(deviceState);
  const left = reminderOptions(timed).filter(o => !value.includes(o.minutes));
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
              {reminderLabel(m, timed)}
              <button
                type="button"
                onClick={() => onChange(value.filter(x => x !== m))}
                className="flex h-6 w-6 items-center justify-center rounded text-brand-600 transition-colors hover:bg-brand-100"
                aria-label={`Retirer le rappel « ${reminderLabel(m, timed)} »`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          {!value.length && <span className="mr-1 text-[13px] text-stone-500">Aucun</span>}
          {left.length > 0 && value.length < 10 && (
            <select
              value=""
              onChange={e => e.target.value !== '' && onChange([...value, Number(e.target.value)])}
              aria-label="Ajouter un rappel"
              className="field h-8 w-auto pr-7 text-[13px] text-stone-600 pointer-coarse:h-9"
            >
              <option value="">+ Ajouter un rappel</option>
              {left.map(o => (
                <option key={o.minutes} value={o.minutes}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
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
