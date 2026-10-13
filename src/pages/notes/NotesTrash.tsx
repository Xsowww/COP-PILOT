import { ArrowLeft, FileText, Folder, RotateCcw, Trash2 } from 'lucide-react';
import { useNotes, notesTrashRoots, folderDescendants } from '../../store/notes';
import { TRASH_DAYS } from '../../store/drive';
import { daysLeft, leftLabel } from './noteUtils';
import { confirmAction, toast } from '../../store/ui';
import { stripHtml } from '../../lib/utils';

const deletedOn = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '');

export default function NotesTrash({ onOpen, onBack }: { onOpen: (noteId: string) => void; onBack: () => void }) {
  const trashFolders = useNotes(s => s.trashFolders);
  const trashNotes = useNotes(s => s.trashNotes);
  const store = useNotes.getState();
  const roots = notesTrashRoots(trashFolders, trashNotes);
  const rows = [
    ...roots.folders.map(f => {
      const ids = new Set(folderDescendants(trashFolders, f.id));
      const count = trashNotes.filter(n => n.folderId && ids.has(n.folderId)).length;
      return { id: f.id, folder: true, title: f.name, sub: count ? `${count} note${count > 1 ? 's' : ''}` : 'Dossier vide', deletedAt: f.deletedAt };
    }),
    ...roots.notes.map(n => ({ id: n.id, folder: false, title: n.title, sub: stripHtml(n.content).slice(0, 90) || 'Note vide', deletedAt: n.deletedAt })),
  ].sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));

  const restore = (id: string, title: string) => {
    store.restore([id]);
    toast(`« ${title} » restauré`, 'success');
  };

  const purge = async (id: string, title: string, folder: boolean) => {
    if (!(await confirmAction(`Supprimer « ${title} » définitivement ?`, folder ? 'Le dossier et ses notes ne pourront plus être récupérés.' : 'La note ne pourra plus être récupérée.', 'Supprimer définitivement'))) return;
    store.purge([id]);
  };

  const empty = async () => {
    if (!(await confirmAction('Vider la corbeille ?', `${rows.length} élément${rows.length > 1 ? 's' : ''} seront supprimés définitivement.`, 'Vider la corbeille'))) return;
    store.emptyTrash();
    toast('Corbeille vidée', 'success');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-2 border-b border-stone-100 px-4 pb-4 pt-6 md:px-8">
        <button className="icon-btn mt-0.5 md:hidden" onClick={onBack} title="Retour" aria-label="Retour">
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold tracking-[-0.015em]">Corbeille</h2>
          <p className="mt-0.5 text-[13px] text-stone-500">Les notes supprimées restent ici {TRASH_DAYS} jours, puis sont effacées.</p>
        </div>
        {rows.length > 0 && (
          <button className="btn-secondary h-8 px-3 text-red-600 hover:text-red-700" onClick={() => void empty()}>
            <Trash2 size={14} /> Vider la corbeille
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 md:px-5">
        {rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <Trash2 size={26} strokeWidth={1.5} className="text-stone-300" />
            <p className="mt-3 text-[14px] font-medium">La corbeille est vide</p>
            <p className="mt-1 text-[13px] text-stone-500">Les notes et dossiers supprimés apparaîtront ici.</p>
          </div>
        ) : (
          rows.map(r => (
            <div key={r.id} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-stone-50">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => (r.folder ? undefined : onOpen(r.id))} disabled={r.folder}>
                {r.folder ? <Folder size={17} className="shrink-0 text-stone-400" /> : <FileText size={17} className="shrink-0 text-stone-400" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{r.title}</span>
                  <span className="block truncate text-[12px] text-stone-500">{r.sub}</span>
                </span>
              </button>
              <span className="hidden shrink-0 text-right text-[12px] sm:block">
                <span className="block text-stone-500">Supprimé le {deletedOn(r.deletedAt)}</span>
                <span className={daysLeft(r.deletedAt) <= 3 ? 'text-red-600' : 'text-stone-500'}>{leftLabel(r.deletedAt)}</span>
              </span>
              <div className="flex shrink-0 gap-0.5">
                <button className="icon-btn" title="Restaurer" aria-label="Restaurer" onClick={() => restore(r.id, r.title)}>
                  <RotateCcw size={15} />
                </button>
                <button className="icon-btn hover:bg-red-50 hover:text-red-600" title="Supprimer définitivement" aria-label="Supprimer définitivement" onClick={() => void purge(r.id, r.title, r.folder)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
