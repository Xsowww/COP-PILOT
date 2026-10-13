import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilePlus2, FileText, Search, Share2 } from 'lucide-react';
import { useGroups } from '../../store/groups';
import { useNotes } from '../../store/notes';
import { toast } from '../../store/ui';
import { Modal } from '../../components/Overlays';
import { createNote, groupError, summary, type Group } from '../../lib/groups';
import { cx, normalize, relativeTime, stripHtml } from '../../lib/utils';
import { useMemberName } from './util';
import GroupNoteEditor from './GroupNoteEditor';

/** « Partager une de mes notes » : copie une note personnelle dans le groupe. */
function SharePicker({ group, onPicked, onClose }: { group: Group; onPicked: (id: string) => void; onClose: () => void }) {
  const notes = useNotes(s => s.notes);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const nq = normalize(q);
  const list = useMemo(
    () => [...notes].filter(n => !nq || normalize(n.title).includes(nq)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 50),
    [notes, nq],
  );
  const pick = async (id: string) => {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    setBusy(id);
    try {
      const copy = await createNote(group.id, n.title, n.content);
      useGroups.getState().upsertNote(summary(copy));
      toast('Note partagée avec le groupe', 'success');
      onPicked(copy.id);
    } catch (e) {
      toast(groupError(e), 'error');
      setBusy(null);
    }
  };
  return (
    <div>
      <h3 className="text-[15px] font-semibold">Partager une de mes notes</h3>
      <p className="mt-1 text-[13px] text-stone-500">
        Une copie est ajoutée à « {group.name} ». Ta note d’origine reste privée et ne change pas.
      </p>
      <div className="relative mt-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher une note" className="field w-full pl-8" />
      </div>
      <div className="mt-2 max-h-[320px] overflow-y-auto">
        {list.length === 0 && <p className="p-6 text-center text-[13px] text-stone-500">{notes.length ? 'Aucune note trouvée' : 'Tu n’as pas encore de note personnelle.'}</p>}
        {list.map(n => (
          <button
            key={n.id}
            disabled={busy !== null}
            onClick={() => void pick(n.id)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-stone-50 disabled:opacity-50"
          >
            <FileText size={15} className="shrink-0 text-stone-400" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{n.title}</span>
              <span className="block truncate text-[12px] text-stone-500">{stripHtml(n.content).slice(0, 120) || 'Note vide'}</span>
            </span>
            {busy === n.id && <span className="text-[12px] text-stone-500">Copie…</span>}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn-secondary" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

export default function GroupNotes({ group }: { group: Group }) {
  const [params, setParams] = useSearchParams();
  const notes = useGroups(s => s.notes[group.id]);
  const nameOf = useMemberName(group.id);
  const [sharing, setSharing] = useState(false);
  const [creating, setCreating] = useState(false);
  const openId = params.get('note');

  const open = (id: string | null) => setParams(id ? { g: group.id, note: id } : { g: group.id });

  const newNote = async () => {
    setCreating(true);
    try {
      const n = await createNote(group.id);
      useGroups.getState().upsertNote(summary(n));
      open(n.id);
    } catch (e) {
      toast(groupError(e), 'error');
    } finally {
      setCreating(false);
    }
  };

  if (openId) {
    return (
      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <GroupNoteEditor key={openId} noteId={openId} onClose={() => open(null)} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <p className="eyebrow mr-auto">{notes ? `${notes.length} note${notes.length > 1 ? 's' : ''} partagée${notes.length > 1 ? 's' : ''}` : 'Chargement…'}</p>
        <button className="btn-secondary h-8 px-3" onClick={() => setSharing(true)}>
          <Share2 size={14} /> Partager une de mes notes
        </button>
        <button className="btn-primary h-8 px-3" disabled={creating} onClick={() => void newNote()}>
          <FilePlus2 size={14} /> Nouvelle note
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {notes && notes.length === 0 && (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <FileText size={26} strokeWidth={1.5} className="text-stone-300" />
            <p className="mt-3 text-[14px] font-medium">Pas encore de note dans ce groupe</p>
            <p className="mt-1 max-w-[380px] text-[13px] text-stone-500">
              Commence une fiche de révision que tout le monde peut compléter, ou partage une note que tu as déjà écrite.
            </p>
          </div>
        )}
        {notes && notes.length > 0 && (
          <div className="card divide-y divide-stone-100 overflow-hidden">
            {notes.map(n => (
              <button key={n.id} onClick={() => open(n.id)} className={cx('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50')}>
                <FileText size={16} className="shrink-0 text-stone-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{n.title}</span>
                  <span className="block truncate text-[12px] text-stone-500">
                    Modifiée par {nameOf(n.updatedBy)} {relativeTime(n.updatedAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal open={sharing} onClose={() => setSharing(false)} width={480}>
        {sharing && (
          <SharePicker
            group={group}
            onClose={() => setSharing(false)}
            onPicked={id => {
              setSharing(false);
              open(id);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
