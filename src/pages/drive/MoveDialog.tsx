import { useState } from 'react';
import { ChevronRight, HardDrive } from 'lucide-react';
import { Modal } from '../../components/Overlays';
import { useDrive, childrenOf, withDescendants, FOLDER_COLORS } from '../../store/drive';
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
            <div className={cx('flex h-8 items-center gap-1.5 rounded-md pr-2 text-[13px]', target === f.id ? 'bg-brand-50 font-medium text-brand-700' : 'hover:bg-stone-100')} style={{ paddingLeft: 8 + depth * 18 }}>
              {hasKids ? (
                <button
                  type="button"
                  className={cx('rounded p-0.5 text-stone-500 transition', expanded && 'rotate-90')}
                  aria-label={expanded ? `Replier « ${f.name} »` : `Déplier « ${f.name} »`}
                  aria-expanded={expanded}
                  onClick={() =>
                    setOpen(s => {
                      const n = new Set(s);
                      if (n.has(f.id)) n.delete(f.id);
                      else n.add(f.id);
                      return n;
                    })
                  }
                >
                  <ChevronRight size={14} />
                </button>
              ) : (
                <span className="w-[18px] shrink-0" />
              )}
              <button type="button" className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left" aria-pressed={target === f.id} onClick={() => setTarget(f.id)}>
                <FileIcon category="folder" size={20} color={f.color ? FOLDER_COLORS[f.color]?.color : undefined} />
                <span className="truncate">{f.name}</span>
              </button>
            </div>
            {expanded && renderLevel(f.id, depth + 1)}
          </div>
        );
      });

  return (
    <Modal open onClose={onClose} width={440}>
      <h3 className="text-[15px] font-semibold">Déplacer vers…</h3>
      <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-stone-200 p-1">
        <button
          type="button"
          className={cx('flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium', target === null ? 'bg-brand-50 text-brand-700' : 'hover:bg-stone-100')}
          aria-pressed={target === null}
          onClick={() => setTarget(null)}
        >
          <HardDrive size={16} /> Mon Drive
        </button>
        {renderLevel(null, 1)}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Annuler
        </button>
        <button className="btn-primary" onClick={() => onMove(target)}>
          Déplacer ici
        </button>
      </div>
    </Modal>
  );
}
