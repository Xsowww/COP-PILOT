import { useCallback, useEffect, useState } from 'react';
import { Bug, Check, Flag, Lightbulb, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { REPORT_REASONS } from '../../lib/feedback';
import { confirmAction, toast } from '../../store/ui';
import { cx, formatBytes, relativeTime } from '../../lib/utils';

interface Report {
  id: string;
  kind: 'note' | 'file' | 'event';
  reason: string;
  message: string | null;
  snapshot: { title?: string; excerpt?: string; group?: string; date?: string; start?: string | null; place?: string | null; size?: number };
  status: 'open' | 'dismissed' | 'removed';
  created_at: string;
  reporter: string | null;
  author: string | null;
  still_there: boolean;
}

interface Feedback {
  id: string;
  kind: 'idea' | 'bug';
  message: string;
  page: string | null;
  device: string | null;
  status: 'open' | 'done';
  created_at: string;
  email: string | null;
}

const KIND = { note: 'Note', file: 'Fichier', event: 'Événement' } as const;
const reasonLabel = (r: string) => REPORT_REASONS.find(x => x.value === r)?.label ?? r;

/** Signalements des groupes et messages « Avis ou bug » (supabase/migrations/2026-10-16b_signalements_avis.sql). */
export default function AdminInbox() {
  const [data, setData] = useState<{ reports: Report[]; feedback: Feedback[] } | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: d, error } = await supabase.rpc('admin_inbox');
    if (error) {
      setMissing(/admin_inbox|function|schema cache/i.test(error.message));
      return;
    }
    setMissing(false);
    setData(d as { reports: Report[]; feedback: Feedback[] });
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const handle = async (r: Report, action: 'remove' | 'dismiss') => {
    if (!supabase) return;
    if (action === 'remove' && !(await confirmAction('Retirer ce contenu du groupe ?', `« ${r.snapshot.title ?? ''} » sera supprimé pour tous les membres. Les autres signalements de ce contenu seront classés.`, 'Retirer'))) return;
    setBusy(r.id);
    const { data: path, error } = await supabase.rpc('admin_handle_report', { p_id: r.id, p_action: action });
    // A file: its content leaves the storage too.
    if (!error && typeof path === 'string' && path) await supabase.storage.from('groups').remove([path]);
    setBusy(null);
    if (error) return toast('Action impossible. Réessaie.', 'error');
    toast(action === 'remove' ? 'Contenu retiré.' : 'Signalement classé.', 'success');
    void load();
  };

  const toggleDone = async (f: Feedback) => {
    if (!supabase) return;
    setBusy(f.id);
    const { error } = await supabase.rpc('admin_feedback_done', { p_id: f.id, p_done: f.status === 'open' });
    setBusy(null);
    if (error) return toast('Action impossible. Réessaie.', 'error');
    void load();
  };

  if (missing) {
    return (
      <section className="card mt-3 p-4">
        <h2 className="text-[13px] font-medium text-stone-600">Signalements et avis</h2>
        <p className="mt-2 text-[13px] text-stone-500">Applique la migration 2026-10-16b_signalements_avis.sql dans Supabase pour recevoir ici les signalements des groupes et les messages « Avis ou bug ».</p>
      </section>
    );
  }
  if (!data) return null;
  const openReports = data.reports.filter(r => r.status === 'open');
  const openFeedback = data.feedback.filter(f => f.status === 'open');

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <section className="card overflow-hidden" aria-labelledby="admin-reports">
        <h2 id="admin-reports" className="flex items-center gap-2 border-b border-stone-100 px-4 py-3 text-[13px] font-medium text-stone-600">
          <Flag size={14} /> Signalements
          {openReports.length > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{openReports.length} à traiter</span>}
        </h2>
        {data.reports.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-stone-500">Aucun signalement.</p>
        ) : (
          <ul className="max-h-[420px] divide-y divide-stone-100 overflow-y-auto">
            {data.reports.map(r => (
              <li key={r.id} className={cx('px-4 py-3', r.status !== 'open' && 'opacity-60')}>
                <div className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-stone-500">
                  <span className="font-medium text-ink">{KIND[r.kind]}</span>
                  {r.snapshot.group && <span>· {r.snapshot.group}</span>}
                  <span>· {relativeTime(r.created_at)}</span>
                  {r.status !== 'open' && <span>· {r.status === 'removed' ? 'retiré' : 'classé'}</span>}
                </div>
                <p className="mt-1 text-[14px] font-medium">« {r.snapshot.title ?? 'Sans titre'} »</p>
                {r.snapshot.excerpt && <p className="mt-1 line-clamp-3 text-[12.5px] text-stone-600">{r.snapshot.excerpt}</p>}
                {r.kind === 'event' && r.snapshot.date && (
                  <p className="mt-1 text-[12.5px] text-stone-600">
                    {r.snapshot.date}
                    {r.snapshot.start && ` · ${r.snapshot.start}`}
                    {r.snapshot.place && ` · ${r.snapshot.place}`}
                  </p>
                )}
                {r.kind === 'file' && r.snapshot.size != null && <p className="mt-1 text-[12.5px] text-stone-600">{formatBytes(r.snapshot.size)}</p>}
                <p className="mt-1.5 text-[12.5px]">
                  <span className="font-medium text-red-700">{reasonLabel(r.reason)}</span>
                  {r.message && <span className="text-stone-600"> — {r.message}</span>}
                </p>
                <p className="mt-1 text-[11.5px] text-stone-500">
                  Signalé par {r.reporter ?? 'un compte supprimé'} · auteur {r.author ?? 'inconnu'}
                </p>
                {r.status === 'open' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.still_there ? (
                      <button className="btn-danger h-8 text-[12px]" disabled={busy === r.id} onClick={() => void handle(r, 'remove')}>
                        <Trash2 size={13} /> Retirer le contenu
                      </button>
                    ) : (
                      <span className="self-center text-[12px] text-stone-500">Déjà supprimé par le groupe.</span>
                    )}
                    <button className="btn-secondary h-8 text-[12px]" disabled={busy === r.id} onClick={() => void handle(r, 'dismiss')}>
                      {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Classer sans suite
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden" aria-labelledby="admin-feedback">
        <h2 id="admin-feedback" className="flex items-center gap-2 border-b border-stone-100 px-4 py-3 text-[13px] font-medium text-stone-600">
          <Lightbulb size={14} /> Avis et bugs
          {openFeedback.length > 0 && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{openFeedback.length} nouveau{openFeedback.length > 1 ? 'x' : ''}</span>}
        </h2>
        {data.feedback.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-stone-500">Aucun message pour l’instant.</p>
        ) : (
          <ul className="max-h-[420px] divide-y divide-stone-100 overflow-y-auto">
            {data.feedback.map(f => (
              <li key={f.id} className={cx('flex gap-3 px-4 py-3', f.status === 'done' && 'opacity-60')}>
                <span className={cx('mt-0.5 shrink-0', f.kind === 'bug' ? 'text-red-600' : 'text-amber-600')} aria-label={f.kind === 'bug' ? 'Bug' : 'Avis'}>
                  {f.kind === 'bug' ? <Bug size={15} /> : <Lightbulb size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-[13.5px]">{f.message}</p>
                  <p className="mt-1 text-[11.5px] text-stone-500">
                    {f.email ?? 'compte supprimé'} · {relativeTime(f.created_at)}
                    {f.page && ` · ${f.page}`}
                    {f.device && ` · ${f.device}`}
                  </p>
                </div>
                <button
                  className="icon-btn shrink-0"
                  disabled={busy === f.id}
                  title={f.status === 'open' ? 'Marquer comme traité' : 'Remettre à traiter'}
                  aria-label={f.status === 'open' ? 'Marquer comme traité' : 'Remettre à traiter'}
                  onClick={() => void toggleDone(f)}
                >
                  {f.status === 'open' ? <Check size={15} /> : <RotateCcw size={15} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
