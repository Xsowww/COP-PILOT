import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useTodos } from '../store/todos';
import { useCalendar } from '../store/calendar';
import { cheer, weekItems } from '../lib/weekProgress';
import { cx } from '../lib/utils';

/** The ring of the week: how much of what was planned is done, filling up as things get ticked. */
export default function WeekProgress({ from, to }: { from: string; to: string }) {
  const todos = useTodos(s => s.todos);
  const events = useCalendar(s => s.events);
  const { total, done } = weekItems(todos, events, from, to);
  const ratio = total ? done / total : 0;
  const full = total > 0 && done === total;
  const R = 46;
  const C = 2 * Math.PI * R;
  return (
    <Link to="/taches" className="group flex flex-1 items-center gap-5 rounded-2xl" aria-label={`${done} sur ${total} faits cette semaine. ${cheer(done, total)}`}>
      <span className="relative h-[116px] w-[116px] shrink-0">
        <svg viewBox="0 0 116 116" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="58" cy="58" r={R} fill="none" strokeWidth="12" className="stroke-stone-100" />
          <circle
            cx="58"
            cy="58"
            r={R}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - ratio)}
            className={cx('transition-[stroke-dashoffset,stroke] duration-700 ease-out', full ? 'stroke-emerald-500' : 'stroke-tile-blue', !done && 'opacity-0')}
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          {full ? (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check size={24} strokeWidth={3} />
            </span>
          ) : (
            <span className="tabular text-[28px] font-extrabold leading-none tracking-[-0.04em]">
              {Math.round(ratio * 100)}
              <span className="text-[15px]">%</span>
            </span>
          )}
        </span>
      </span>
      <span className="min-w-0">
        <span className="tabular block text-[26px] font-extrabold leading-none tracking-[-0.03em]">
          {done}
          <span className="text-[16px] font-bold text-stone-500"> / {total}</span>
        </span>
        <span className="mt-1 block text-[13px] font-medium text-stone-500">faits cette semaine</span>
        <span className={cx('mt-2.5 block text-[13px] font-semibold leading-snug', full ? 'text-emerald-700 dark:text-emerald-400' : 'text-ink')}>{cheer(done, total)}</span>
      </span>
    </Link>
  );
}
