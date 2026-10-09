import { useEffect, useState } from 'react';
import { Pause, Play, Square, Timer } from 'lucide-react';
import { useFocus, focusLeft, mmss } from '../store/focus';
import { useSettings } from '../store/settings';
import { cx } from '../lib/utils';

/** Compact Pomodoro timer shown in the sidebar. */
export default function FocusTimer() {
  const focus = useFocus();
  const { focusMinutes, breakMinutes } = useSettings();
  const [, setNow] = useState(0);

  useEffect(() => {
    if (!focus.phase) return;
    const t = setInterval(() => {
      useFocus.getState().tick();
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [focus.phase]);

  if (!focus.phase) {
    return (
      <button
        onClick={() => focus.start()}
        className="mb-2 flex h-9 w-full items-center gap-2.5 rounded-lg border border-dashed border-stone-300 px-2.5 text-[13px] text-stone-600 transition-colors hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
        title={`${focusMinutes} min de travail, ${breakMinutes} min de pause`}
      >
        <Timer size={15} />
        Session focus
        <span className="tabular ml-auto text-[11px] text-stone-400">{focusMinutes} min</span>
      </button>
    );
  }

  const left = focusLeft(focus);
  const total = (focus.phase === 'focus' ? focusMinutes : breakMinutes) * 60_000;
  const paused = focus.pausedLeft !== null;
  return (
    <div className={cx('mb-2 rounded-lg border p-2.5', focus.phase === 'focus' ? 'border-brand-200 bg-brand-50' : 'border-emerald-200 bg-emerald-50')}>
      <div className="flex items-center gap-2">
        <span className={cx('text-[11px] font-medium', focus.phase === 'focus' ? 'text-brand-700' : 'text-emerald-700')}>
          {focus.phase === 'focus' ? 'Concentration' : 'Pause'}
          {paused && ' · en pause'}
        </span>
        <span className="tabular ml-auto font-mono text-[15px] font-medium">{mmss(left)}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white">
        <div className={cx('h-full rounded-full', focus.phase === 'focus' ? 'bg-brand-500' : 'bg-emerald-500')} style={{ width: `${100 - (left / total) * 100}%` }} />
      </div>
      <div className="mt-2 flex gap-1">
        <button onClick={paused ? focus.resume : focus.pause} className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-white text-[12px] font-medium text-stone-700 shadow-card hover:text-ink">
          {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? 'Reprendre' : 'Pause'}
        </button>
        <button onClick={focus.stop} className="flex h-7 w-8 items-center justify-center rounded-md bg-white text-stone-500 shadow-card hover:text-red-600" title="Arrêter">
          <Square size={11} />
        </button>
      </div>
    </div>
  );
}
