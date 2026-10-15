import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilePlus2, FileText } from 'lucide-react';
import { useGroups } from '../../store/groups';
import { toast } from '../../store/ui';
import { createNote, groupError, summary, type Group } from '../../lib/groups';
import { cx, relativeTime } from '../../lib/utils';
import { useGroupWords, useMemberName, useRights } from './util';
import GroupNoteEditor from './GroupNoteEditor';

export default function GroupNotes({ group }: { group: Group }) {
  const w = useGroupWords();
  const [params, setParams] = useSearchParams();
  const notes = useGroups(s => s.notes[group.id]);
  const nameOf = useMemberName(group.id);
  const { canEdit } = useRights(group);
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
        <GroupNoteEditor key={openId} noteId={openId} readOnly={!canEdit} onClose={() => open(null)} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <p className="eyebrow mr-auto">{notes ? `${notes.length} note${notes.length > 1 ? 's' : ''} partagée${notes.length > 1 ? 's' : ''}` : 'Chargement…'}</p>
        {canEdit && (
          <button className="btn-primary h-8 px-3" disabled={creating} onClick={() => void newNote()}>
            <FilePlus2 size={14} /> Nouvelle note
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {notes && notes.length === 0 && (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <FileText size={26} strokeWidth={1.5} className="text-stone-300" />
            <p className="mt-3 text-[14px] font-medium">Pas encore de note dans {w.this}</p>
            <p className="mt-1 max-w-[380px] text-[13px] text-stone-500">
              {canEdit
                ? w.notesHint
                : `Les notes écrites par les éditeurs ${w.of} apparaîtront ici.`}
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
    </div>
  );
}
