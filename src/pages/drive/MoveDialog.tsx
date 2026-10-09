import { useState } from 'react';
import { ChevronRight, HardDrive } from 'lucide-react';
import { Modal } from '../../components/Overlays';
import { useDrive, childrenOf, withDescendants } from '../../store/drive';
import { cx } from '../../lib/utils';
import FileIcon from '../../components/FileIcon';

interface Props {
  ids: string[];
  onClose: () => void;
  onMove: (target: string | null) => void;
}

export default function MoveDialog({ ids, onClose, onMove }: Props) {
  const items = useDrive(s => s.items);
  const forbidden = new Set(withDescendants(items, ids));
  const [target, setTarget] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const renderLevel = (parentId: string | null, depth: number): React.ReactNode =>
    childrenOf(items, parentId)
      .filter(i => i.kind === 'folder' && !forbidden.has(i.id))
      .map(f => {
        const hasKids = items.some(i => i.parentId === f.id && i.kind === 'folder' && !forbidden.has(i.id));
        const expanded = open.has(f.id);
        return (
          <div key={f.id}>
            <div
              className={cx('flex cursor-pointer items-center gap-1.5 rounded-xl py-1.5 pr-2 text-sm', target === f.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50')}
              style={{ paddingLeft: 8 + depth * 18 }}
              onClick={() => setTarget(f.id)}
            >
              <button
                className={cx('rounded p-0.5 text-slate-400 transition', !hasKids && 'invisible', expanded && 'rotate-90')}
                onClick={e => {
                  e.stopPropagation();
                  setOpen(s => {
                    const n = new Set(s);
                    if (n.has(f.id)) n.delete(f.id);
                    else n.add(f.id);
                    return n;
                  });
                }}
              >
                <ChevronRight size={14} />
              </button>
              <FileIcon category="folder" size={24} />
              <span className="truncate">{f.name}</span>
            </div>
            {expanded && renderLevel(f.id, depth + 1)}
          </div>
        );
      });

  return (
    <Modal open onClose={onClose} width={440}>
      <h3 className="text-lg font-semibold">Déplacer vers…</h3>
      <div className="mt-4 max-h-80 overflow-y-auto rounded-2xl border border-slate-100 p-1.5">
        <div
          className={cx('flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-medium', target === null ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50')}
          onClick={() => setTarget(null)}
        >
          <HardDrive size={16} /> Mon Drive
        </div>
        {renderLevel(null, 1)}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button className="btn-primary" onClick={() => onMove(target)}>
          Déplacer ici
        </button>
      </div>
    </Modal>
  );
}
