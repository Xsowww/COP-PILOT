import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { addDays } from 'date-fns';
import { Award, Clock3, ListChecks, Table2, ChartNoAxesColumn, Timer, type LucideIcon } from 'lucide-react';
import { useFocusLog } from '../../store/focusLog';
import { useCalendar } from '../../store/calendar';
import { useTodos } from '../../store/todos';
import { useSettings } from '../../store/settings';
import { useBadges, currentStreak } from '../../lib/badges';
import { toKey, fmt, fromKey } from '../../lib/dates';
import { cx } from '../../lib/utils';
import FocusTimer from '../../components/FocusTimer';
import TodoList from './TodoList';
import BadgeGrid from './BadgeGrid';
import { SubjectBars, DailyFocus, DataTable, FOCUS_COLOR } from './FocusCharts';
import { dailyMinutes, formatMinutes, minutesBySubject, weekMinutes } from './focusStats';

type Range = '7' | '30' | 'all';
const RANGES: { key: Range; label: string }[] = [
  { key: '7', label: '7 jours' },
  { key: '30', label: '30 jours' },
  { key: 'all', label: 'Tout' },
];

function Section({ id, icon: Icon, title, color, aside, children }: { id: string; icon: LucideIcon; title: string; color: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `color-mix(in srgb, ${color} 12%, var(--color-surface))`, color }}>
          <Icon size={14} strokeWidth={2} />
        </span>
        <h2 className="mr-auto text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-4 py-3.5">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.02em]">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-stone-500">{sub}</p>}
    </div>
  );
}

export default function ProgressPage() {
  const location = useLocation();
  const sessions = useFocusLog(s => s.sessions);
  const events = useCalendar(s => s.events);
  const todos = useTodos(s => s.todos);
  const focusSessions = useSettings(s => s.focusSessions);
  const badges = useBadges();
  const [range, setRange] = useState<Range>('30');
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  const bySubject = useMemo(() => minutesBySubject(sessions, range === 'all' ? null : toKey(addDays(new Date(), 1 - Number(range)))), [sessions, range]);
  const daily = useMemo(() => dailyMinutes(sessions, 30), [sessions]);
  const week = weekMinutes(sessions);
  const month = daily.reduce((a, d) => a + d.minutes, 0);
  const activeDays = daily.filter(d => d.minutes > 0).length;
  const streak = currentStreak(events);
  const openTodos = todos.filter(t => !t.done).length;
  const earned = badges.filter(b => b.earned).length;

  const tableToggle = (
    <button onClick={() => setAsTable(v => !v)} className="btn-ghost h-8 px-2.5 text-[12px]" aria-pressed={asTable}>
      {asTable ? <ChartNoAxesColumn size={14} /> : <Table2 size={14} />}
      {asTable ? 'Voir en graphique' : 'Voir en tableau'}
    </button>
  );

  return (
    <div className="h-full overflow-y-auto px-4 pb-12 md:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="pb-6 pt-2">
          <p className="eyebrow">Tâches, temps de travail et badges</p>
          <h1 className="mt-0.5 text-[24px] font-semibold tracking-[-0.02em]">Progression</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Cette semaine" value={formatMinutes(week)} sub="de travail en focus" />
          <Stat label="Sessions" value={String(Math.max(sessions.length, focusSessions))} sub="terminées au total" />
          <Stat label="Moyenne par jour" value={formatMinutes(Math.round(month / 30))} sub={`sur 30 jours · ${activeDays} jour${activeDays > 1 ? 's' : ''} actif${activeDays > 1 ? 's' : ''}`} />
          <Stat label="Série en cours" value={`${streak} jour${streak > 1 ? 's' : ''}`} sub={streak ? 'continue comme ça' : 'coche un élément du calendrier'} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Section id="taches" icon={ListChecks} title="Tâches" color="var(--color-brand-500)" aside={<span className="tabular text-[12px] text-stone-500">{openTodos} à faire</span>}>
            <div className="card flex min-h-[200px] flex-col p-4">
              <TodoList grouped />
            </div>
          </Section>

          <Section id="travail" icon={Clock3} title="Temps de travail" color={FOCUS_COLOR} aside={tableToggle}>
            <div className="mb-3 md:hidden">
              <FocusTimer />
            </div>
            <div className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div>
                  <h3 className="text-[13px] font-medium text-stone-600">Par matière</h3>
                  <p className="text-[12px] text-stone-500">Minutes en session focus</p>
                </div>
                <div className="ml-auto flex rounded-lg bg-stone-100 p-0.5" role="group" aria-label="Période">
                  {RANGES.map(r => (
                    <button
                      key={r.key}
                      onClick={() => setRange(r.key)}
                      aria-pressed={range === r.key}
                      className={cx('h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors', range === r.key ? 'bg-surface text-ink shadow-card' : 'text-stone-500 hover:text-ink')}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                {asTable ? (
                  <DataTable head={['Matière', 'Temps', 'Sessions']} rows={bySubject.map(r => [r.subject, formatMinutes(r.minutes), r.sessions])} />
                ) : (
                  <SubjectBars rows={bySubject} />
                )}
              </div>

              <div className="mt-6 border-t border-stone-100 pt-4">
                <div className="flex items-baseline gap-2">
                  <h3 className="mr-auto text-[13px] font-medium text-stone-600">Par jour</h3>
                  <p className="tabular text-[12px] text-stone-500">
                    <span className="text-[15px] font-semibold text-ink">{formatMinutes(month)}</span> sur 30 jours
                  </p>
                </div>
                <div className="mt-3">
                  {asTable ? (
                    <DataTable
                      head={['Jour', 'Temps']}
                      rows={[...daily].reverse().map(d => [fmt(fromKey(d.day), 'EEE d MMM'), d.minutes ? formatMinutes(d.minutes) : '–'])}
                    />
                  ) : (
                    <DailyFocus data={daily} />
                  )}
                </div>
              </div>
              {sessions.length === 0 && (
                <p className="mt-4 flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2.5 text-[12px] text-stone-500">
                  <Timer size={14} className="shrink-0" /> Lance une session focus et choisis la matière : ton temps de travail apparaîtra ici.
                </p>
              )}
            </div>
          </Section>
        </div>

        <div className="mt-10">
          <Section
            id="badges"
            icon={Award}
            title="Badges"
            color="#d48a17"
            aside={
              <span className="flex items-center gap-2 text-[12px] text-stone-500">
                <span className="h-1 w-20 overflow-hidden rounded-full bg-stone-200/70">
                  <span className="block h-full rounded-full bg-[#d48a17]" style={{ width: `${(earned / badges.length) * 100}%` }} />
                </span>
                <span className="tabular">
                  {earned} sur {badges.length} obtenus
                </span>
              </span>
            }
          >
            <BadgeGrid badges={badges} />
          </Section>
        </div>
      </div>
    </div>
  );
}
