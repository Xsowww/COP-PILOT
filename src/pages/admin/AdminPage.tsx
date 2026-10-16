import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw, Search, ShieldCheck, Users, Activity, HardDrive, NotebookText, CalendarDays, FolderClosed, Loader2 } from 'lucide-react';
import { supabase, cloudEnabled, checkIsAdmin } from '../../lib/supabase';
import { CATEGORIES, type BuiltinCategory } from '../../store/calendar';
import { formatBytes, relativeTime, cx } from '../../lib/utils';
import { fmt, fromKey } from '../../lib/dates';
import AdminInbox from './AdminInbox';

interface Account {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  mfa: boolean;
  admin: boolean;
  notes: number;
  events: number;
  files: number;
  storage: number;
}

interface Stats {
  generated_at: string;
  users: { total: number; confirmed: number; new_7d: number; active_24h: number; active_7d: number; active_30d: number };
  mfa_users: number;
  content: { notes: number; note_folders: number; events: number; events_done: number; files: number; folders: number; storage_bytes: number };
  events_by_category: Partial<Record<string, number>>;
  /** Categories created by the users (migration 2026-10-16), grouped by name. */
  custom_categories?: { label: string; events: number; users: number }[];
  days: { day: string; signups: number; created: number }[];
  accounts: Account[];
}

const REFRESH_MS = 20_000;

function Kpi({ icon: Icon, label, value, sub, color }: { icon: typeof Users; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `color-mix(in srgb, ${color} 12%, var(--color-surface))`, color }}>
          <Icon size={14} />
        </span>
        <span className="text-[12px] font-medium text-stone-500">{label}</span>
      </div>
      <p className="tabular mt-3 text-[28px] font-semibold leading-none tracking-tight">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-stone-500">{sub}</p>}
    </div>
  );
}

/** Daily columns, one series: 2px gaps, 4px rounded caps, hover tooltip, recessive grid. */
function DailyColumns({ data, valueKey, label, color }: { data: Stats['days']; valueKey: 'signups' | 'created'; label: string; color: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = data.map(d => d[valueKey]);
  const max = Math.max(1, ...values);
  const top = max <= 4 ? 4 : Math.ceil(max / 5) * 5;
  const W = 600;
  const H = 140;
  const slot = W / data.length;
  const bar = Math.min(16, slot - 2);
  const total = values.reduce((a, b) => a + b, 0);
  const tip = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <p className="tabular text-[13px] text-stone-500">
        <span className="text-[20px] font-semibold text-ink">{total}</span> {label} sur 30 jours
      </p>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="mt-3 w-full overflow-visible" role="img" aria-label={`${label} par jour sur 30 jours : ${total} au total, maximum ${max} par jour`} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1="0" x2={W} y1={H - f * H} y2={H - f * H} stroke="var(--color-stone-200)" strokeWidth="1" />
            {f > 0 && (
              <text x={W} y={H - f * H - 4} textAnchor="end" fontSize="10" fill="var(--color-stone-500)">
                {Math.round(top * f)}
              </text>
            )}
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d[valueKey] / top) * H;
          const x = i * slot + (slot - bar) / 2;
          const r = Math.min(4, h / 2, bar / 2);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)}>
              <rect x={i * slot} y="0" width={slot} height={H} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x} ${H} V${H - h + r} Q${x} ${H - h} ${x + r} ${H - h} H${x + bar - r} Q${x + bar} ${H - h} ${x + bar} ${H - h + r} V${H} Z`}
                  fill={color}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
            </g>
          );
        })}
        {[0, 14, 29].map(i => (
          <text key={i} x={i * slot + slot / 2} y={H + 14} textAnchor={i === 0 ? 'start' : i === 29 ? 'end' : 'middle'} fontSize="10" fill="var(--color-stone-500)">
            {fmt(fromKey(data[i].day), 'd MMM')}
          </text>
        ))}
      </svg>
      {tip && hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 rounded-md bg-inverse px-2.5 py-1.5 text-[12px] text-on-inverse shadow-pop"
          style={{ left: `clamp(0px, calc(${((hover + 0.5) / data.length) * 100}% - 60px), calc(100% - 120px))` }}
        >
          <p className="text-on-inverse/60">{fmt(fromKey(tip.day), 'EEEE d MMMM')}</p>
          <p className="tabular font-medium">
            {tip[valueKey]} {label}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: err } = await supabase.rpc('admin_stats');
    setLoading(false);
    if (err) {
      setError(err.message.includes('mfa') ? 'Reconnecte-toi avec ton code de sécurité pour voir ces chiffres.' : 'Impossible de charger les statistiques.');
      return;
    }
    setError('');
    setStats(data as Stats);
  }, []);

  useEffect(() => {
    void checkIsAdmin().then(setAllowed);
  }, []);

  // Live view: refresh every 20 s and when coming back to the tab.
  useEffect(() => {
    if (!allowed) return;
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [allowed, load]);

  const accounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (stats?.accounts ?? []).filter(a => !q || a.email.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [stats, query]);

  if (!cloudEnabled || allowed === false) return <Navigate to="/" replace />;

  const u = stats?.users;
  const c = stats?.content;
  const categories = (Object.keys(CATEGORIES) as BuiltinCategory[]).map(k => ({ key: k, n: stats?.events_by_category[k] ?? 0 }));
  // « Autres » : the events in the categories users created themselves (ids « c-… »).
  const others = Object.entries(stats?.events_by_category ?? {}).reduce((sum, [k, n]) => (k.startsWith('c-') ? sum + (n ?? 0) : sum), 0);
  const customs = stats?.custom_categories;
  const catMax = Math.max(1, others, ...categories.map(x => x.n));

  return (
    <div className="h-full overflow-y-auto px-4 pb-12 md:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-center gap-3 pb-5 pt-2">
          <div className="mr-auto">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Administration</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-stone-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              En direct · {stats ? `mis à jour à ${fmt(new Date(stats.generated_at), 'HH:mm:ss')}` : 'chargement…'} · visible par toi uniquement
            </p>
          </div>
          <button className="btn-secondary h-8" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Actualiser
          </button>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}

        {!stats ? (
          !error && (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-stone-400" />
            </div>
          )
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi icon={Users} label="Comptes" value={u!.total} sub={`+${u!.new_7d} cette semaine`} color="var(--color-brand-500)" />
              <Kpi icon={Activity} label="Actifs (7 jours)" value={u!.active_7d} sub={`${u!.active_24h} aujourd’hui · ${u!.active_30d} sur 30 jours`} color="#2f9e6b" />
              <Kpi icon={ShieldCheck} label="Double authentification" value={`${u!.total ? Math.round((stats.mfa_users / u!.total) * 100) : 0} %`} sub={`${stats.mfa_users} compte${stats.mfa_users > 1 ? 's' : ''} protégé${stats.mfa_users > 1 ? 's' : ''}`} color="#7a5ad6" />
              <Kpi icon={HardDrive} label="Stockage" value={formatBytes(c!.storage_bytes)} sub={`${c!.files} fichiers · ${c!.folders} dossiers`} color="#3b6fd8" />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <Kpi icon={NotebookText} label="Notes" value={c!.notes} sub={`${c!.note_folders} dossiers`} color="#d48a17" />
              <Kpi icon={CalendarDays} label="Événements" value={c!.events} sub={`${c!.events ? Math.round((c!.events_done / c!.events) * 100) : 0} % terminés`} color="#d9483b" />
              <Kpi icon={FolderClosed} label="Fichiers" value={c!.files} sub={u!.total ? `${(c!.files / u!.total).toFixed(1)} par compte` : undefined} color="#3b6fd8" />
            </div>

            <AdminInbox />

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <section className="card p-4">
                <h2 className="text-[13px] font-medium text-stone-600">Activité</h2>
                <p className="text-[12px] text-stone-500">Notes, événements et fichiers créés par jour</p>
                <div className="mt-3">
                  <DailyColumns data={stats.days} valueKey="created" label="éléments créés" color="var(--color-brand-500)" />
                </div>
              </section>
              <section className="card p-4">
                <h2 className="text-[13px] font-medium text-stone-600">Inscriptions</h2>
                <p className="text-[12px] text-stone-500">Nouveaux comptes par jour</p>
                <div className="mt-3">
                  <DailyColumns data={stats.days} valueKey="signups" label="inscriptions" color="#3b6fd8" />
                </div>
              </section>
            </div>

            <section className="card mt-3 p-4">
              <h2 className="text-[13px] font-medium text-stone-600">Calendrier : répartition des événements</h2>
              <div className="mt-3 space-y-2">
                {categories.map(({ key, n }) => (
                  <div key={key} className="grid grid-cols-[90px_1fr_48px] items-center gap-3 text-[13px]">
                    <span className="flex items-center gap-2 text-stone-600">
                      <span className="h-2 w-2 rounded-full" style={{ background: CATEGORIES[key].color }} />
                      {CATEGORIES[key].label}
                    </span>
                    <span className="h-3 overflow-hidden rounded-r-[4px] bg-stone-100">
                      <span className="block h-full rounded-r-[4px]" style={{ width: `${(n / catMax) * 100}%`, background: CATEGORIES[key].color }} />
                    </span>
                    <span className="tabular text-right text-stone-600">{n}</span>
                  </div>
                ))}
                <div className="grid grid-cols-[90px_1fr_48px] items-center gap-3 text-[13px]">
                  <span className="flex items-center gap-2 text-stone-600">
                    <span className="h-2 w-2 rounded-full bg-stone-400" />
                    Autres
                  </span>
                  <span className="h-3 overflow-hidden rounded-r-[4px] bg-stone-100">
                    <span className="block h-full rounded-r-[4px] bg-stone-400" style={{ width: `${(others / catMax) * 100}%` }} />
                  </span>
                  <span className="tabular text-right text-stone-600">{others}</span>
                </div>
              </div>
              <div className="mt-4 border-t border-stone-100 pt-3">
                <h3 className="text-[12px] font-medium text-stone-600">
                  Autres : catégories créées par les utilisateurs{customs ? ` (${customs.length})` : ''}
                </h3>
                {!customs ? (
                  <p className="mt-1 text-[12px] text-stone-500">Le détail s’affichera une fois la migration 2026-10-16 appliquée sur Supabase.</p>
                ) : customs.length === 0 ? (
                  <p className="mt-1 text-[12px] text-stone-500">Aucune catégorie personnelle pour l’instant.</p>
                ) : (
                  <ul className="mt-2 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
                    {customs.map(c => (
                      <li key={c.label} className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate">{c.label}</span>
                        <span className="tabular shrink-0 text-[12px] text-stone-500">
                          {c.events} événement{c.events > 1 ? 's' : ''} · {c.users} compte{c.users > 1 ? 's' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="card mt-3 overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-4 py-3">
                <h2 className="mr-auto text-[13px] font-medium text-stone-600">
                  Comptes <span className="tabular text-stone-500">({accounts.length})</span>
                </h2>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom ou e-mail" className="field h-8 w-56 pl-8" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-[13px]">
                  <thead>
                    <tr className="border-b border-stone-100 text-left text-[12px] text-stone-500">
                      <th className="px-4 py-2 font-medium">Compte</th>
                      <th className="px-3 py-2 font-medium">Inscrit</th>
                      <th className="px-3 py-2 font-medium">Dernière connexion</th>
                      <th className="px-3 py-2 font-medium">Sécurité</th>
                      <th className="px-3 py-2 text-right font-medium">Notes</th>
                      <th className="px-3 py-2 text-right font-medium">Événements</th>
                      <th className="px-3 py-2 text-right font-medium">Fichiers</th>
                      <th className="px-4 py-2 text-right font-medium">Stockage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(a => (
                      <tr key={a.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50">
                        <td className="px-4 py-2.5">
                          <p className="font-medium">
                            {a.name || '—'}
                            {a.admin && <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">Admin</span>}
                          </p>
                          <p className="text-[12px] text-stone-500">{a.email}</p>
                        </td>
                        <td className="px-3 py-2.5 text-stone-600">{fmt(new Date(a.created_at), 'd MMM yyyy')}</td>
                        <td className="px-3 py-2.5 text-stone-600">{a.last_sign_in_at ? relativeTime(a.last_sign_in_at) : 'jamais'}</td>
                        <td className="px-3 py-2.5">
                          <span className={cx('inline-flex items-center gap-1 text-[12px]', a.mfa ? 'text-emerald-700' : 'text-stone-500')}>
                            <ShieldCheck size={13} /> {a.mfa ? '2FA active' : 'Sans 2FA'}
                          </span>
                        </td>
                        <td className="tabular px-3 py-2.5 text-right">{a.notes}</td>
                        <td className="tabular px-3 py-2.5 text-right">{a.events}</td>
                        <td className="tabular px-3 py-2.5 text-right">{a.files}</td>
                        <td className="tabular px-4 py-2.5 text-right text-stone-600">{formatBytes(a.storage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <p className="mt-3 text-[11px] text-stone-500">
              Seuls des chiffres sont affichés : le contenu des notes, des événements et des fichiers des étudiants n’est jamais visible ici.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
